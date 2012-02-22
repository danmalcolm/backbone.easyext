Backbone.easyext = (function () {

	// Dirty tracking

	var DirtyTracker = function (model) {
		this.model = model;
		this.initialize();

	};
	_.extend(DirtyTracker.prototype, {

		initialize: function () {
			this.trackLastSyncedState();
			this.model.on("sync", this.trackLastSyncedState, this);
		},

		trackLastSyncedState: function () {
			this.lastSyncedState = this.cloneState(this.model);
		},

		isDirty: function () {
			var currentState = this.cloneState(this.model);
			var dirty = !_.isEqual(this.lastSyncedState, currentState);
			return dirty;
		},

		// Returns a deep clone of the model's attributes, cloning the
		// attributes of nested models
		cloneState: function (model) {
			var obj = {};
			var attributes = model.attributes;
			for (var name in attributes) {
				var value = attributes[name];
				value = value && value.toJSON ? value.toJSON() : value;
				obj[name] = value;
			}
			return obj;
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

	// Attribute conversion

	var modelComparer = {
		// Indicates whether a set of attributes belongs to the specified model.
		// This check is required when the model's attributes are set using data from
		// the server during sync or fetch.
		attributesCorrelateWithModel: function (model, attributes) {

			if (!_.isNull(model.id) && model.id === attributes[model.idAttribute]) {
				// Comparing persistent model (id available) and ids match (easy)
				return true;
			}
			// Model not persistent, so test for "business key equality" - http://docs.jboss.org/hibernate/orm/3.3/reference/en/html/persistent-classes.html#persistent-classes-equalshashcode
			var current = this.getDataToCompare(model, model.attributes);
			var newData = this.getDataToCompare(model, attributes, function (key, value) {
				return model.prepareValue(key, value, model.attributes);
			});
			return _.isEqual(current, newData);
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
						// Looks like a model with correlationAttrs so add nested object
						// containing values
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
			canConvert: function (descriptor) {
				return _.isFunction(descriptor.model);
			},
			convert: function (parent, key, value, attributes, descriptor) {
				if (value instanceof descriptor.model) {
					// Value being set already the kind of model we need
					return value;
				}
				if (!_.isObject(value)) {
					// Can't convert to model if value not an attributes object TODO: needs error, warning?
					return value;
				}
				var newAttributes = value;
				var model;
				model = attributes[key];
				if (model instanceof descriptor.model && modelComparer.attributesCorrelateWithModel(model, newAttributes)) {
					// Update attributes of existing model, so that we don't end up with
					// a different model instance (objects might be bound to events)
					model.set(newAttributes);
				} else {
					// Convert to model
					model = new descriptor.model(newAttributes);
				}
				return model;
			},
			_isSameModel: function (model, newAttributes) {

				return attrsCorrelateWithModel(existing, newAttributes);
			}

		},
		// creates a collection instance using ctor specified by "collection" property
		collectionConvertor: {
			canConvert: function (descriptor) {
				return _.isFunction(descriptor.collection);
			},
			convert: function (parent, key, value, attributes, descriptor) {
				if (value instanceof descriptor.collection) {
					// Value being set is already the kind of collection we need
					return value;
				}
				if (!_.isArray(value)) {
					// Can't convert TODO: needs error, warning?
					return value;
				}
				var collection = attributes[key]; ;
				if (collection instanceof descriptor.collection) {
					// Return existing collection, so that we don't end up with
					// a different collection instance (objects might be bound
					// to collection)
					this.mergeModels(collection, value);
				} else {
					// Convert array to collection
					collection = new descriptor.collection(value, { parent: parent });
				}
				return collection;
			},
			mergeModels: function (collection, modelsData) {

				var idAttribute = collection.model.prototype.idAttribute;
				var transientModels = collection.filter(function (model) {
					return _.isNull(model.id) || _.isUndefined(model.id);
				});

				var models = _.map(modelsData, function (attributes) {
					// Try and find model with same id
					var model = collection.get(attributes[idAttribute]);
					if (!model) {
						// Otherwise find a match among unsaved models
						// TODO - could do with caching result of modelComparer.getDataToCompare
						// as the same model could be compared multiple times
						model = _.detect(transientModels, function (t) {
							return modelComparer.attributesCorrelateWithModel(t, attributes);
						});
					}
					if (model) {
						model.set(attributes);
						return model;
					} else {
						// just use attributes, collection will convert to model
						return attributes;
					}
				});
				collection.reset(models);
			}
		},
		// Converts dates from string value like "/Date(1361441768427)/" used by Microsoft's JSON serializers and JSON.Net: 
		// http://weblogs.asp.net/bleroy/archive/2008/01/18/dates-and-json.aspx
		dotNetDateConvertor: {
			canConvert: function (descriptor) {
				return descriptor.value === ".netjsondate";
			},
			convert: function (parent, key, value, attributes, descriptor) {
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
			this.descriptors = _.isFunction(this.model.attributeConversion) ? this.model.attributeConversion() : {};
		},
		convert: function (key, value, attributes) {
			var descriptor = this.descriptors[key];
			return descriptor ? this.convertValue(key, value, attributes, descriptor) : value;
		},
		convertValue: function (key, value, attributes, descriptor) {
			var convertor = _.detect(convertors, function (c) {
				return c.canConvert(descriptor);
			});
			return convertor ? convertor.convert(this.model, key, value, attributes, descriptor) : value;
		}
	});

	// Mix-in used to extend Model with attribute conversion functionality
	var AttributeConversion = {
		prepareValue: function (key, value, attributes) {
			this.attributeConvertor || (this.attributeConvertor = new AttributeConvertor(this));
			return this.attributeConvertor.convert(key, value, attributes);
		}
	};

	return {
		models: {
			AttributeConversion: AttributeConversion,
			DirtyTracker: DirtyTracker
		}
	};
})();
