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
			return getValue(this.parentView, "childViews");
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
		cleanUp: function () {
			var views = _.flatten(this.created);
			_.each(views, function (view) {
				// Use centrally configured mechanism to clean up child view
				childViewsConfig.cleanUpView(view);
			});
			this.created = [];
		},
		attach: function () {
			this.cleanUp();

			// Select one or more elements specified for this child view and 
			// attach to each. We only select elements the first time that 
			// child views are attached to the parent - this avoids matching
			// on elements within child views.
			if (!this.$elements) {
				var selector = this.config.selector || childViewsConfig.defaultElementSelector(this.name);
				this.$elements = this.parentView.$(selector);
			}
			var self = this;
			this.$elements.each(function () {
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
			return new this.config.view(options);
		},
		createSequence: function ($element) {
			var sequenceConfig = this.config.sequence;
			var optionsSequence;
			if (sequenceConfig.collection) {
				// Config specifies that sequence of child views should be attached 
				// based on models in collection belonging to parent view's model,
				// so we create a sequence of options, each with a model in the collection
				var options = this.getOptions(this.config.options || {}, $element);
				var collection = this.parentView.model ? this.parentView.model.get(sequenceConfig.collection) : null;
				if (collection) {
					optionsSequence = collection.map(function (model) {
						var itemOptions = _.clone(options);
						itemOptions.model = model;
						return itemOptions;
					});
				} else {
					optionsSequence = [];
				}
			} else if (_.isArray(sequenceConfig.options) || _.isFunction(sequenceConfig.options)) {
				optionsSequence = this.getOptions(sequenceConfig.options, $element);
			}
			if (!_.isArray(optionsSequence)) {
				throw new Error('The "sequence" option for child view "' + this.name + '" is invalid. Use either "collection" with the name of a collection attribute on the parent view\'s model or "options" with an array of options');
			}
			
			// Create a view for each object in options sequence
			var views = _.map(optionsSequence, function (o) {
				return new this.config.view(o);
			}, this);
			return views;
		},
		getOptions: function (options, $element) {
			// If options specified via a function, invoke in context of the parent view
			return _.isFunction(options) ? options.call(this.parentView, $element) : _.clone(options);
		}
	});

	// Helper function to get a value from an object as a property
	// or as a function.
	var getValue = function (object, prop) {
		if (!(object && object[prop])) return null;
		return _.isFunction(object[prop]) ? object[prop]() : object[prop];
	};





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
