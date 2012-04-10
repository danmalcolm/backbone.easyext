(function () {

	// Configuration

	var childViewsConfig, defaultChildViewsConfig;
	childViewsConfig = defaultChildViewsConfig = {
		// A hook to allow child views to be cleaned up (unbinding
		// etc) according to an application's requirements. Child views
		// are cleaned up when they are reattached and when the parent
		// view is cleaned up. It is recommended that parent views
		// invoke cleanUp on their ChildViewHelper instance when they
		// are closed.
		cleanUpView: function (view) {

		},
		// The properties that will be used to read child view configuration
		// from the parent view
		configProperties: ["childViews"],
		// Returns the selector used to find elements to which child
		// views should be attached
		defaultElementSelector: function (name) {
			return '[data-childview=' + name + ']';
		},
		// Controls whether render is called automatically upon
		// creation of each child view
		autoRender: true
	};

	// Manages creation of child views that have been configured to be attached
	// to elements within the DOM element managed by a parent view. Child views
	// are specified in an object defined by a "childViews" property defined on 
	// the parent view, e.g.
	//
	// var MyView = Backbone.View.extend({
	//
	//   ...
	// 
	//   childViews: {
	//     attachments: { view: AttachmentsView, options: { position: "left" } }
	//   }
	//   
	//   ...
	// }
	//
	var ChildViewHelper = function (parentView) {
		this.parentView = parentView;
		this.descriptors = [];
		this.descriptorsByName = {};
		this.initializeChildViews();
	};

	_.extend(ChildViewHelper.prototype, {

		initializeChildViews: function () {
			var childViewConfig = this.readChildViewConfig();
			_.each(childViewConfig, function (value, name) {
				var descriptor = new RegisteredChildViewDescriptor(name, this.parentView, value);
				this.descriptors.push(descriptor);
				this.descriptorsByName[name] = descriptor;
			}, this);
		},

		readChildViewConfig: function () {
			var current = {};
			var properties = childViewsConfig.configProperties;
			for (var i = 0, l = properties.length; i < l; i++) {
				var next = getValue(this.parentView, properties[i]);
				if (next) {
					_.extend(current, next);
				}
			}
			return current;
		},

		attach: function () {
			for (var i = 0, l = this.descriptors.length; i < l; i++) {
				this.descriptors[i].attach();
			}
		},

		getCreatedViewOrViews: function (name, at) {
			at || (at = 0);
			var created;
			var descriptor = this.descriptorsByName[name];
			if (descriptor) {
				created = descriptor.created;
			}
			return created ? created[at] : null;
		},

		// Gets instance of child view that has been attached. This is a 
		// convenience method for use by application code that expects
		// a single view to be referenced. 
		getChildView: function (name, at) {
			var created = this.getCreatedViewOrViews(name, at);
			// Verify that expected scenario applies
			if (_.isArray(created)) {
				throw new Error(name + ' should reference an individual child view attached to a container element, but actually references multiple view instances. Use the "getChildViews" function to access a sequence of child views');
			}
			return created;
		},

		// Gets sequence of child views that has been attached. This is a 
		// convenience method for use by application code that expects
		// a sequence of views to be referenced. 
		getChildViews: function (name, at) {
			var created = this.getCreatedViewOrViews(name, at);
			// Verify that expected scenario applies
			if (!_.isArray(created)) {
				throw new Error(name + ' should reference multiple child view instances, but actually references a single view. Use the "getChildView" function to access a single child view');
			}
			return created;
		},

		eachChildView: function (fn) {
			for (var i = 0, l = this.descriptors.length; i < l; i++) {
				this.descriptors[i].eachView(fn);
			}
		},

		cleanUp: function () {
			for (var i = 0, l = this.descriptors.length; i < l; i++) {
				this.descriptors[i].cleanUp();
			}
		}
	});

	// Manages a child view defined on an instance of a parent view
	var RegisteredChildViewDescriptor = function (name, parentView, config) {
		this.name = name;
		this.parentView = parentView;
		this.config = config;
		this.created = [];
	};
	_.extend(RegisteredChildViewDescriptor.prototype, {

		attach: function () {
			this.cleanUp();

			var selector = this.config.selector || childViewsConfig.defaultElementSelector(this.name);
			var $elements = this.parentView.$(selector);
			var self = this;
			$elements.each(function () {
				self.attachToElement($(this));
			});
		},
		attachToElement: function ($element) {
			var created = this.create($element);
			// Track created views. Either a single view or a sequence of views 
			// will be attached to each element. The getChildView and getChildViews
			// functions need to distinguish between these scenarios, so we record
			// created objects as-is.
			this.created.push(created);
			var views = _.isArray(created) ? created : [created];
			for (var i = 0, l = views.length; i < l; i++) {
				var view = views[i];
				if (this.parentView.onCreateChildView)
					this.parentView.onCreateChildView.call(this.parentView, view);
				var render = this.config.autoRender || (this.config.autoRender !== false && childViewsConfig.autoRender);
				if (render) {
					view.render();
				}
			}

			// If we are managing a sequence of views, they are appended to
			// the element (we don't need to do anything with single views
			// as they are attached directly to the element when they are created).
			if (_.isArray(created)) {
				$element.empty().append($(_.pluck(created, "el")));
			}
		},
		create: function ($element) {
			if (!_.isObject(this.config.sequence)) {
				return this.createSingle($element);
			} else {
				return this.createSequence($element);
			}
		},
		createSingle: function ($element) {
			var options = this.getOptions(this.config.options || {}, $element);
			options.el = $element;
			var view = new this.config.view(options);
			if (this.parentView.onCreateChildView)
				this.parentView.onCreateChildView(view);
			return view;
		},
		createSequence: function ($element) {
			var sequenceConfig = this.config.sequence;
			var optionsSequence;

			if (sequenceConfig.collection || sequenceConfig.models) {
				// Config specifies that sequence of child views should be attached 
				// based on models in collection belonging to parent view's model,
				// so we create a sequence of options based on each model
				var models;
				if (sequenceConfig.collection) {
					var collection = this.parentView.model ? this.parentView.model.get(sequenceConfig.collection) : null;
					models = collection ? collection.models : [];
				} else {
					models = sequenceConfig.models;
				}
				var sharedOptions = this.getOptions(this.config.options || {}, $element);
				optionsSequence = _.map(models, function (model) {
					var options = _.clone(sharedOptions);
					options.model = model;
					return options;
				});
			} else if (_.isArray(sequenceConfig.options) || _.isFunction(sequenceConfig.options)) {
				optionsSequence = this.getOptionsSequence(sequenceConfig.options, $element);
			} else {
				throw new Error('The "sequence" option for child view "' + this.name + '" is invalid. Use either "collection" with the name of a collection attribute on the parent view\'s model, "models" to provide an array of models, or "options" to provide an array of options');
			}

			// Create a view for each object in options sequence
			var views = _.map(optionsSequence, function (o) {
				var view = new this.config.view(o);
				if (this.parentView.onCreateChildView)
					this.parentView.onCreateChildView(view);
				return view;
			}, this);
			return views;
		},
		getOptions: function (optionsConfig, $element) {
			// If options specified via a function, invoke in context of the parent view
			var options = _.isFunction(optionsConfig) ? optionsConfig.call(this.parentView, $element) : _.clone(optionsConfig);
			var parentOptions = this.getParentOptions();
			options = _.extend(parentOptions, options);
			this.addParentModelAttributes(options);
			return options;
		},
		getOptionsSequence: function (optionsConfig, $element) {
			// If options specified via a function, invoke in context of the parent view
			var sequence = _.isFunction(optionsConfig) ? optionsConfig.call(this.parentView, $element) : _.clone(optionsConfig);
			if (!_.isArray(sequence)) {
				throw new Error('The "sequence.options" option for child view "' + this.name + '" must supply an array of options objects');
			}
			var parentOptions = this.getParentOptions();
			sequence = _.map(sequence, function (options) {
				options = _.extend(_.clone(parentOptions), options);
				this.addParentModelAttributes(options);
				return options;
			}, this);
			return sequence;
		},
		getParentOptions: function () {
			var parentOptionsConfig = this.config.parentOptions;
			var parentOptions = {};
			if (!parentOptionsConfig) {
				return parentOptions;
			} else if (this.config.parentOptions === "*") {
				parentOptions = _.clone(this.parentView.options);
			} else {
				var keys = parentOptionsConfig.split(whitespaceSplitter);
				for (var i = 0, l = keys.length; i < l; i++) {
					var key = keys[i];
					parentOptions[key] = this.parentView.options[key];
				}
			}
			return parentOptions;
		},
		// It's common for a child view to manage a collection or model that is
		// an attribute of the parent view's model - the model and collection 
		// properties on the child view configuration provide a shortcut to 
		// setting these properties
		addParentModelAttributes: function (options) {
			var parentModel = this.parentView.model;
			if (parentModel) {
				_.each(["model", "collection"], function (optionsKey) {
					var attributeKey = this.config[optionsKey];
					if (attributeKey) {
						options[optionsKey] = parentModel.get(attributeKey);
					}
				}, this);
			}
		},
		cleanUp: function () {
			var views = _.flatten(this.created);
			_.each(views, function (view) {
				// Use centrally configured mechanism to clean up child view
				childViewsConfig.cleanUpView(view);
			});
			this.created = [];
		},
		eachView: function (fn) {
			_.each(_.flatten(this.created), function (view) {
				fn(view);
			});
		}
	});
	var whitespaceSplitter = /\s+/;

	// Helper function to get a value from an object as a property
	// or as a function.
	var getValue = function (object, prop) {
		if (!(object && object[prop])) return null;
		return _.isFunction(object[prop]) ? object[prop]() : object[prop];
	};



	// Mix-in used to extend View with child view functionality
	var ChildViews = {
		attachChildViews: function () {
			var helper = this.childViewHelper || (this.childViewHelper = new ChildViewHelper(this));
			return helper.attach.apply(helper, arguments);
		},
		getChildView: function (name, at) {
			if (this.childViewHelper) {
				return this.childViewHelper.getChildView(name, at);
			}
		},
		getChildViews: function (name, at) {
			if (this.childViewHelper) {
				return this.childViewHelper.getChildViews(name, at);
			}
		},
		eachChildView: function (fn) {
			if (this.childViewHelper) {
				this.childViewHelper.eachChildView(fn);
			}
		}
	};

	// Define a scope for extensions
	var root = this;
	root.Backbone.easyext = root.Backbone.easyext || {};
	root.Backbone.easyext.views = {
		ChildViews: ChildViews,
		// Configurable behaviour, pass null to reset to default settings
		configureChildViews: function (config) {
			childViewsConfig = _.extend(_.clone(defaultChildViewsConfig), config);
		}
	};
})();
