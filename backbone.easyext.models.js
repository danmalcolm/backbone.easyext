(function () {

	// ----------------------------------------------------------------------------------------
	// Dirty tracking extension functionality

	var DirtyTracker = function (model) {
		this.model = model;
		this.initialize();

	};

	// Returns a deep clone of a model's attributes, cloning the
	// attributes of any nested models
	var cloneState = function (source) {
		
		if (!_.isObject(source)) return source;

		if (source.toJSON) return cloneState(source.toJSON());
		
		if (_.isArray(source)) return _.map(source, cloneState);

		var clone = {};
		for (var key in source) {
			var value = source[key];
			clone[key] = cloneState(value);
		}
		return clone;
	};

	_.extend(DirtyTracker.prototype, {

		initialize: function () {
			this.trackLastSyncedState();
			this.model.on("sync", this.trackLastSyncedState, this);
		},

		trackLastSyncedState: function () {
			this.lastSyncedState = cloneState(this.model);
		},

		isDirty: function () {
			var currentState = cloneState(this.model);
			var dirty = !_.isEqual(this.lastSyncedState, currentState);
			return dirty;
		}


	});

	// Extends a model with dirty tracking functionality by creating
	// an instance of DirtyTracker bound to the model and adding an
	// isDirty method to the model.
	DirtyTracker.extendModel = function (model) {
		var tracker = new DirtyTracker(model);
		// Add new method to model
		model.isDirty = function () {
			return tracker.isDirty();
		};
	};

	// Example of how to add dirty tracking functionality to a model 
	// supertype, probably simplest way to add dirty tracking functionality 
	// to your application if you have simple models
	var ModelWithDirtyTracking = Backbone.Model.extend({
		constructor: function () {
			Backbone.Model.prototype.constructor.apply(this, arguments);
			Backbone.easyext.models.DirtyTracker.extendModel(this);
		}
	});

	var MyModel = ModelWithDirtyTracking.extend({
		/* other stuff */
	});

	// Important: If you extend your models as above and you are using
	// a deep model graph, each individual model in the graph will end up 
	// doing its own dirty tracking, which probably isn't what you need. You'll
	// be interested in the overall state of the root object. In this case, you
	// should instantiate an instance of DirtyTracker directly in your view
	// using the root model.
	var MyView = Backbone.View.extend({
		initialize: function () {
			this.tracker = new Backbone.easyext.models.DirtyTracker(this.model);
		},
		isModelDirty: function () {
			return this.tracker.isDirty();
		}
	});


	// ----------------------------------------------------------------------------------------
	// Attribute conversion extension functionality

	var modelComparer = {
		// Indicates whether a set of attributes belongs to the specified model.
		// This check is required when the model's attributes are set using data from
		// the server during sync or fetch.
		attributesCorrelateWithModel: function (model, cache, attributes, options) {
			if (!_.isNull(model.id) && model.id === attributes[model.idAttribute]) {
				// Comparing persistent model (id available) and ids match (easy)
				return true;
			}

			// Model not persistent, but attributes might belong to this model (e.g. after syncing)
			// so test for "business key equality" - http://docs.jboss.org/hibernate/orm/3.3/reference/en/html/persistent-classes.html#persistent-classes-equalshashcode

			// Optimisation for collection scenarios, where a model will be compared multiple times
			var modelCompareData;
			modelCompareData = cache && cache[model.cid] ? cache[model.cid] : this.getDataToCompare(model, model.attributes);
			if (cache)
				cache[model.cid] = modelCompareData;

			// Convert attributes as specified by model's attribute conversion configuration 
			// so that we are comparing correctly converted attributes
			var newData = this.getDataToCompare(model, attributes, function (key, value) {
				var convertor = model.attributeConvertor;
				var convertOptions = _.extend({}, options, { inPlace: false });
				return convertor ? convertor.convertValue(key, value, convertOptions) : value;
			});
			return _.isEqual(modelCompareData, newData);
		},

		getDataToCompare: function (model, attributes, convert) {
			var attrs = model.correlationAttrs;
			if (!_.isArray(attrs)) {
				throw Error("model must have a 'correlationAttrs' property to allow it to be compared with values from server during fetch / sync");
			}
			var data = _.reduce(attrs, function (memo, name) {
				var value = attributes[name];
				if (convert) {
					value = convert(name, value);
				}
				if (value) {
					if (value.attributes && _.isArray(value.correlationAttrs)) {
						// Looks like a model with correlationAttrs so add a 
						// nested object with the specified attributes
						value = this.getDataToCompare(value, value.attributes);
					} else if (value && _.isFunction(value.toJSON)) {
						value = value.toJSON();
					}
				}
				memo[name] = value;
				return memo;
			}, {}, this);
			return data;
		}
	};


	// Convertors
	var standardConvertors = {
		// converts raw object to a model instance using ctor specified by "model" property
		modelConvertor: {
			appliesTo: function (attrConfig) {
				return _.isFunction(attrConfig.model);
			},
			convert: function (parent, descriptor, value, options) {
				if (value instanceof descriptor.model) {
					// Value being set already the kind of model we need
					return value;
				}
				if (!_.isObject(value)) {
					// Can't convert to model if value not an attributes object TODO: needs error, warning?
					return value;
				}
				var model;
				// Get existing model
				model = parent.attributes[descriptor.key];
				if (options.inPlace !== false
					&& model instanceof descriptor.model
					&& modelComparer.attributesCorrelateWithModel(model, null, value, options)) {
					// Existing model is equivalent so update its attributes in-place.
					// Setting inPlace to false is used if we don't want conversion to have
					// side effects on child models belonging to target model, see modelComparer.getDataToCompare
					model.set(value, { silent: options.silent });
				} else {
					// Convert raw data to model
					model = new descriptor.model(value);
				}
				return model;
			}

		},
		// creates a collection instance using ctor specified by "collection" property
		collectionConvertor: {
			appliesTo: function (attrConfig) {
				return _.isFunction(attrConfig.collection);
			},
			convert: function (parent, descriptor, value, options) {
				if (value instanceof descriptor.collection) {
					// Value being set is already the kind of collection we need
					return value;
				}
				if (!_.isArray(value)) {
					// Can't convert TODO: needs error, warning?
					return value;
				}
				var collection = parent.attributes[descriptor.key];
				if (options.inPlace !== false && collection instanceof descriptor.collection) {
					// Return existing collection (after updating its contents)
					this.mergeModels(collection, value, options);
				} else {
					// Convert array to collection
					var collectionOptions = { parent: parent };
					collection = new descriptor.collection(value, collectionOptions);
				}
				return collection;
			},
			mergeModels: function (collection, modelsData, options) {

				var idAttribute = collection.model.prototype.idAttribute;
				var transientModels = collection.filter(function (model) {
					return _.isNull(model.id) || _.isUndefined(model.id);
				});
				var cache = {};
				var models = _.map(modelsData, function (attributes) {
					// Try and find model with same id
					var model = collection.get(attributes[idAttribute]);
					if (!model) {
						// Otherwise find a match among unsaved models
						model = _.detect(transientModels, function (transientModel) {
							return modelComparer.attributesCorrelateWithModel(transientModel, cache, attributes, options);
						});
					}
					if (model) {
						// trigger events based on options supplied in call to set
						model.set(attributes, { silent: options.silent });
						return model;
					} else {
						// just use attributes, collection will convert to model
						return attributes;
					}
				});
				collection.reset(models, { silent: options.silent });
			}
		},
		// Converts dates from string value like "/Date(1361441768427)/" used by some Microsoft JSON serializers 
		// and (originally) JSON.Net: 
		// http://weblogs.asp.net/bleroy/archive/2008/01/18/dates-and-json.aspx
		dotNetDateConvertor: {
			appliesTo: function (attrConfig) {
				return attrConfig.value === ".netjsondate";
			},
			convert: function (parent, descriptor, value) {
				var match = /\/Date\((-?\d+)\)\//.exec(value);
				return match ? new Date(Number(match[1])) : value;
			}
		}

	};
	var convertors = [standardConvertors.modelConvertor, standardConvertors.collectionConvertor, standardConvertors.dotNetDateConvertor];

	// Handles attribute conversion for a model instance and manages conversion of attribute values to 
	// specified types, e.g. raw objects to Models, arrays to Collections
	var AttributeConvertor = function (model) {
		this.model = model;
		this.initialize();
	};


	_.extend(AttributeConvertor.prototype, {
		initialize: function () {
			this.descriptors = this.getDescriptors();
		},
		getDescriptors: function () {
			var descriptors = {};
			var modelConfig = this.model.attributeConversion || {};
			if (_.isFunction(modelConfig))
				modelConfig = modelConfig();
			if (_.isObject(modelConfig)) {
				for (var key in modelConfig) {
					var attrConfig = modelConfig[key];
					var convertor = _.detect(convertors, function (c) { return c.appliesTo(attrConfig); });
					if (!convertor) attrConfigError(key, attrConfig, "Could not find suitable convertor");
					var descriptor = _.extend({ key: key, convertor: convertor }, attrConfig);
					descriptors[key] = descriptor;
				}
			}
			return descriptors;
		},
		attrConfigError: function (key, config, message) {
			throw new Error("The config for converting attribute '" + key + "' is invalid. "
				+ message + "\nPlease check the config supplied via your model's attributeConversion method");
		},
		convertValues: function (attrs, options) {
			var converted = {};
			for (var key in attrs) {
				converted[key] = this.convertValue(key, attrs[key], options);
			}
			return converted;
		},
		convertValue: function (key, value, options) {
			var descriptor = this.descriptors[key];
			return (descriptor && descriptor.convertor)
				? descriptor.convertor.convert(this.model, descriptor, value, options)
				: value;
		}
	});

	// Mix-in used to extend Model with attribute conversion functionality
	var AttributeConversion = {
		prepareValues: function (attrs, options) {
			this.attributeConvertor || (this.attributeConvertor = new AttributeConvertor(this));
			return this.attributeConvertor.convertValues(attrs, options);
		}
	};

	// Define a scope for extensions
	var root = this;
	root.Backbone.easyext = root.Backbone.easyext || {};
	root.Backbone.easyext.models = {
		AttributeConversion: AttributeConversion,
		DirtyTracker: DirtyTracker
	};
})();
