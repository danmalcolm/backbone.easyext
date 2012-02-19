Backbone.easyext = (function () {

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
						// Looks like a model with correlationAttrs so add nested object containing values
						value = getCorrelationData(value, attributes);
					} else if (value && _.isFunction(value.toJSON)) {
						value = value.toJSON();
					}
				}
				memo[name] = value;
				return memo;
			}, {});
			return data;
		}
	};

	// Attribute conversion

	// Convertors
	var standardConvertors = {
		// converts raw object to a model instance using ctor specified by "model" property
		modelConvertor: {
			canConvert: function (descriptor) {
				return _.isFunction(descriptor.model);
			},
			convert: function (key, value, attributes, descriptor) {
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
			convert: function (key, value, attributes, descriptor) {
				if (value instanceof descriptor.collection) {
					// Value being set is already the kind of collection we need
					return value;
				}
				if (!_.isArray(value)) {
					// Can't convert TODO: needs error, warning?
					return value;
				}
				var collection;
				if (attributes[key] instanceof descriptor.collection) {
					// Return existing collection, so that we don't end up with
					// a different collection instance (objects might be bound
					// to collection)
					collection = attributes[key];
					// TODO: merge array of data with models in collection
					collection.reset(value);
				} else {
					// Convert array to collection
					collection = new descriptor.collection(value);
				}
				return collection;
			}
		}
	};
	var convertors = [standardConvertors.modelConvertor, standardConvertors.collectionConvertor];

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
			return convertor ? convertor.convert(key, value, attributes, descriptor) : value;
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
			AttributeConversion: AttributeConversion
		}
	};
})();
