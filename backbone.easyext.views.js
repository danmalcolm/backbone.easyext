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
		// from the parent view. Multiple properties might be useful when you
		// have a view hierarchy, with items "inheriting" common definitions
		// and adding their owon
		configProperties: ["childViews"],
		// Returns the selector used to find elements to which child
		// views should be attached. By default elements are identified
		// by the data-childview attribute, <div data-childview="child1">
		defaultElementSelector: function (name) {
			return '[data-childview=' + name + ']';
		},
		// Controls whether render is called automatically following
		// creation of each child view
		autoRender: true
	};

	// Manages creation of child views that have been configured to be attached
	// to elements within the DOM element managed by a parent view. Child views
	// are specified via a "childViews" property defined on the parent view, e.g.
	//
	// var MyView = Backbone.View.extend({
	//
	//   ...
	// 
	//   childViews: function() {
	//		return {
	//			attachments: { view: AttachmentsView, options: { position: "left" } }
	//		};
	//   }
	//   ...
	// }
	//
	// A function is commonly used to allow access to the scope of the view at runtime and
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
				if(!value.ignore) {
					var descriptor = new RegisteredChildViewDescriptor(name, this.parentView, value);
					this.descriptors.push(descriptor);
					this.descriptorsByName[name] = descriptor;
				}
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

		attachChildViews: function () {
			var names = arguments;
			var filtering = names.length > 0;
			for (var i = 0, l = this.descriptors.length; i < l; i++) {
				if (!filtering || _.include(names, this.descriptors[i].name)) {
					this.descriptors[i].attach();
				}
			}
		},

		getCreated: function (name, single, sequence) {
			var created;
			var descriptor = this.descriptorsByName[name];
			if (!descriptor) {
				throw new Error('Child view definition "' + name + '" does not exist on the parent view.');
			}

			// Ensure we have instances or sequences
			if (sequence !== descriptor.isSequence) {
				if (sequence) {
					throw new Error('getChildViewSequence and getChildViewSequences are not valid for child view definition "' + name + '", which adds a single view. Use getChildView(s) for child views that do not generate a sequence.');
				} else {
					throw new Error('getChildView and getChildViews are not valid for child view definition "' + name + '", which generates sequences of views. Use getChildViewSequence(s) for child views that generated sequences.');
				}
			}

			created = descriptor.created;
			if (!created) {
				throw new Error('Child view definition "' + descriptor.name + '" has not attached any views to the parent view. Either attachViews has not been called or no matching elements were found within the parent view element.');
			}

			// Ensure we have single instance / sequence if required
			if (single && created.length > 1) {
				throw new Error('Child view definition "' + descriptor.name + '" has attached a view or sequence of views to more than one element within the parent view\'s element. getChildView and getChildViewSequence are designed only for situations where the child view definition has been applied to a single element. Use getChildViews and getChildViewSequences instead.');
			}


			return single ? created[0] : created;
		},

		// Gets instance of child view that has been attached to a single
		// element within the parent view element. An error is thrown if
		// a child view with the given name has been attached to more than
		// one element. This is intended to simplify application code that 
		// expects a single instance.
		getChildView: function (name) {
			return this.getCreated(name, true, false);
		},

		// Gets array of child view instances that have been attached to one or
		// more elements within the parent view element.
		getChildViews: function (name) {
			return this.getCreated(name, false, false);
		},

		// Gets sequence of child views that have been attached to a single
		// element within the parent view element. An error is thrown if
		// a child view sequence with the given name has been attached to more than
		// one element. This is intended to simplify application code that 
		// expects a single sequence.
		getChildViewSequence: function (name) {
			return this.getCreated(name, true, true);
		},

		// Gets array of child view sequences that have been attached to one or
		// more elements within the parent view element.
		getChildViewSequences: function (name) {
			return this.getCreated(name, false, true);
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
		if (!config.view) {
			throw new Error('view property undefined on child view "' + name + '"');
		}
		this.created = [];
		this.isSequence = !_.isUndefined(config.sequence);
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
			// will be attached to each element. The getChildView and getChildViewSequence
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
				// Config specifies that sequence of child views should be generated
				// from a sequence of models
				var models;
				if (sequenceConfig.collection) {
					var collection;
					if (_.isString(sequenceConfig.collection)) {
						// collection: "something" means collection is attribute of parent view's model
						collection = this.parentView.model ? this.parentView.model.get(sequenceConfig.collection) : null;
					}
					else {
						collection = getValue(sequenceConfig, "collection", this.parentView);
					}
					models = collection instanceof Backbone.Collection ? collection.models : [];
				} else {
					models = getValue(sequenceConfig, "models", this.parentView);
				}

				var sharedOptions = this.getOptions(this.config.options || {}, $element);
				var index = 0;
				optionsSequence = _.map(models, function (model) {
					var options = _.clone(sharedOptions);
					options.model = model;
					options.childViewContext = { index: index++ };
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
			this.addModelAndCollectionOptions(options);
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
				this.addModelAndCollectionOptions(options);
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
				delete parentOptions.el;
			} else {
				var keys = parentOptionsConfig.split(whitespaceSplitter);
				for (var i = 0, l = keys.length; i < l; i++) {
					var key = keys[i];
					if (key != 'el') {
						parentOptions[key] = this.parentView.options[key];
					}
				}
			}
			return parentOptions;
		},
		// It's common for a child view to manage a collection or model that is
		// either:
		// - an attribute of the parent view's model
		// - obtained via a function when the child view is created 
		// The 'model' and 'collection' properties on the child view configuration 
		// provide a shortcut to setting these properties
		addModelAndCollectionOptions: function (options) {
			_.each(["model", "collection"], function (key) {
				if (this.config[key]) {
					var option = getValue(this.config, key, this.parentView);
					if (_.isString(option) && this.parentView.model) {
						option = this.parentView.model.get(option);
					}
					options[key] = option;
				}
			}, this);
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
	var getValue = function (object, prop, context) {
		if (!(object && object[prop])) return null;
		context = context || object;
		return _.isFunction(object[prop]) ? object[prop].apply(context) : object[prop];
	};



	// "Mix-in" used to extend Backbone.View with child view functionality
	var ChildViews = { };
	// Add functions from ChildViewHelper to our extension - they'll just delegate from view to ChildViewHelperInstance
	_.each(["attachChildViews", "getChildView", "getChildViews", "getChildViewSequence", "getChildViewSequences", "eachChildView"], function (name) {
		ChildViews[name] = function () {
			var helper = this.childViewHelper || (this.childViewHelper = new ChildViewHelper(this));
			return helper[name].apply(helper, arguments);
		};
	});

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
