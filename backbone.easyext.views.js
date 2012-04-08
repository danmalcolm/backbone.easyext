(function () {

	var childViewsConfig, defaultChildViewsConfig;
	childViewsConfig = defaultChildViewsConfig = {
		cleanUpView: function (view) {

		}
	};



	// Handlers - responsible for creating child view instances based
	// on elements defined in the parent view

	// Handles creation of child views using explicitly registered
	// view definitions, usually combining some globally defined
	// and others on the parent view itself
	var RegisteredChildViewHandler = function (parentView, childViewConfig) {
		this.parentView = parentView;
		this.descriptors = {};
		_.each(childViewConfig, function (value, name) {
			var descriptor = new RegisteredChildViewDescriptor(name, parentView, value);
			this.descriptors[name] = descriptor;
		}, this);
	};
	_.extend(RegisteredChildViewHandler.prototype, {
		handle: function (parentView, $container, config) {
			// Find descriptor matching value in data-childview attribute
			var descriptor = this.descriptors[config];
			if (descriptor) {
				// Cleanup and remove references to any active child views that are about to be recreated
				descriptor.cleanUp();
				var created = descriptor.createViews($container); // return view or array of views
				var views = _.isArray(created) ? created : [created];
				for (var i = 0, l = views.length; i < l; i++) {
					var view = views[i];
					if (!view) {
						throw new Error("Child view instance not created for " + descriptor.name);
					}
					if (parentView.onCreateChildView)
						parentView.onCreateChildView.call(this.parentView, view);
					view.render();
				}
				return true;
			} else {
				return false;
			}
		},
		getCreated: function (name) {
			var descriptor = this.descriptors[name];
			if (descriptor) {
				return descriptor.created;
			}
		},
		cleanUp: function () {
			_.each(this.descriptors, function (descriptor) {
				descriptor.cleanUp();
			});
		}
	});

	// Creates / manages child view(s) based on explicitly registered configuration
	var RegisteredChildViewDescriptor = function (name, parentView, config) {
		this.name = name;
		this.parentView = parentView;
		this.config = config;
		this.created = null;
		this.active = [];
	};
	_.extend(RegisteredChildViewDescriptor.prototype,{
		cleanUp: function () {
			_.each(this.active, function (view) {
				// Use centrally configured mechanism to clean up child view
				childViewsConfig.cleanUpView(view);
			});
			this.created = null;
			this.active = [];
		},
		createOptions: function () {
			// If options specified via a function, invoke in context of the parent view
			var options = _.isFunction(this.config.options) ?
				this.config.options.apply(this.parentView)
				: _.clone(this.config.options);

			if (this.config.collection) {
				// Config specifies that child view sequence should be created based on collection 
				// belonging to parent view's model, so we create a sequence of options
				if (_.isArray(options)) {
					throw new Error('The collection setting "' + this.config.collection + '" for child view "' + this.name + '" is not valid because a sequence of options were specified. It is not possible to generate multiple child views using both an array of options and a collection');
				}
				var collection = this.parentView.model ? this.parentView.model.get(this.config.collection) : null;
				if (collection) {
					options = collection.map(function (model) {
						var itemOptions = _.clone(options);
						itemOptions.model = model;
						return itemOptions;
					});
				}
			}
			return options;
		},
		create: function ($el) {
			var options = this.createOptions();
			if (_.isArray(options)) {
				return this.createSequence(options, $el);
			} else {
				return this.createSingle(options, $el);
			}
		},
		createSingle: function (options, $el) {
			options.el = $el;
			return new this.config.view(options);
		},
		createSequence: function (optionsList, $el) {
			var views = _.map(optionsList, function (options) {
				return new this.config.view(options);
			}, this);
			return views;
		},
		appendSequence: function (views, $el) {
			var childEls = _.map(views, function (view) {
				return view.el;
			});
			// append to container element
			$el.empty();
			$(childEls).appendTo($el);
		},
		createViews: function ($el) {
			// Track items returned from create function - we can then distinguish
			// between individual views and collections of views
			this.created = this.create($el);
			this.active = _.isArray(this.created) ? this.created : [this.created];
			if (_.isArray(this.created)) {
				this.appendSequence(this.created, $el);
			}
			return this.created;
		}
	});

	// Helper function to get a value from an object as a property
	// or as a function.
	var getValue = function (object, prop) {
		if (!(object && object[prop])) return null;
		return _.isFunction(object[prop]) ? object[prop]() : object[prop];
	};

	// Manages a list of child views belonging to a view
	var ChildViewHelper = function (parentView) {
		this.parentView = parentView;
		this.handlers = this.initializeHandlers();
	};

	_.extend(ChildViewHelper.prototype, {

		initializeHandlers: function () {
			// separation of handlers allows different strategies to be used
			// but we've only got one kind atm
			return [new RegisteredChildViewHandler(this.parentView, getValue(this.parentView, "childViews"))];
		},

		attach: function () {
			if (!this.$containers) {
				this.$containers = this.parentView.$("[data-childview]");
			}
			var self = this;
			this.$containers.each(function () {
				var $container = $(this);
				var config = $container.attr("data-childview");
				self.handle($container, config);
			});
		},

		handle: function ($container, config) {
			// Use first available handler
			for (var i = 0, l = this.handlers.length; i < l; i++) {
				if (this.handlers[i].handle(this.parentView, $container, config)) break;
			}
		},

		getActiveViewOrViews: function (name) {
			var result;
			for (var i = 0, l = this.handlers.length; i < l; i++) {
				result = this.handlers[i].getCreated(name);
				if (result) break;
			}
			return result;
		},

		// Gets instance of child view that has been created
		getChildView: function (name) {
			var view = this.getActiveViewOrViews(name);
			if (_.isArray(view)) {
				throw new Error(name + ' should reference an individual child view, but actually references multiple view instances. Use the "getChildViews" function to reference multiple child view instances');
			}
			return view;
		},

		// Gets instances of a sequence of child views that has been created
		getChildViews: function (name) {
			var views = this.getActiveViewOrViews(name);
			if (!_.isArray(views)) {
				throw new Error(name + ' should reference multiple child view instances, but actually references a single view. Use the "getChildView" function to reference a single child view instance');
			}
			return views;
		},

		cleanUp: function () {
			for (var i = 0, l = this.handlers.length; i < l; i++) {
				this.handlers[i].cleanUp();
			}
		}
	});



	// Mix-in used to extend View with child view functionality
	var ChildViews = {

	};

	// Define a scope for extensions
	var root = this;
	root.Backbone.easyext = root.Backbone.easyext || {};
	root.Backbone.easyext.views = {
		ChildViewHelper: ChildViewHelper,
		// Configurable behaviour, pass null to reset to default settings
		configureChildViews: function (config) {
			childViewsConfig = _.extend(_.clone(defaultChildViewsConfig), config);
		}
	};
})();
