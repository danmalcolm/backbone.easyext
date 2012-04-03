(function () {

	// Helper function to get a value from an object as a property
	// or as a function.
	var getValue = function (object, prop) {
		if (!(object && object[prop])) return null;
		return _.isFunction(object[prop]) ? object[prop]() : object[prop];
	};

	// Manages a list of child views belonging to a view
	var ChildViewHelper = function (parentView) {
		this.childViewDescriptors = {};
		this.initialised = false;
		this.parentView = parentView;
	};

	_.extend(ChildViewHelper.prototype, {

		// Ensures that child views have been initialised based on the view's childViews property
		ensureChildViews: function () {
			if (!this.initialised && this.parentView.childViews) {
				var childViews = getValue(this.parentView, 'childViews');
				_.each(childViews, function (config, name) {
					this.addChildViewDescriptor(name, config);
				}, this);
			}
			this.initialised = true;
		},

		// Register a child view. The createChildView function will be called in the context
		// of the current view
		addChildViewDescriptor: function (name, config) {
			var descriptor = {
				name: name,
				view: config.view,
				options: config.options || {},
				created: null,
				active: [],
				reset: function () {
					_.each(this.active, function (view) {
						view.close();
					});
					this.created = null;
					this.active = [];
				},
				_createOptions: function () {
					return _.isFunction(this.options) ? this.options.apply(this.parentView) : _.clone(this.options);
				},
				_create: function (el) {
					var options = this._createOptions();
					options.el = el;
					return new this.view(options);
				},
				createViews: function (el) {
					// Track items returned from create function - we can then distinguish
					// between individual views and collections of views
					this.created = this._create(el);
					this.active = _.isArray(this.created) ? this.created : [this.created];
					return this.created;
				},
				onRender: config.onRender
			};
			this.childViewDescriptors[name] = descriptor;
		},

		// Render views, filtering to views if names supplied, e.g. render("aview", "another"), e.g. 
		render: function () {
			this.ensureChildViews();
			if (!this.$containers) {
				this.$containers = this.parentView.$("[data-childview]");
			}
			var self = this;
			this.$containers.each(function () {
				var $container = $(this);
				var name = $container.attr("data-childview");
				var descriptor = self.childViewDescriptors[name];
				if (descriptor) {
					self.renderChildView(descriptor, $container);
				}
			});
		},

		renderChildView: function (descriptor, $container) {
			descriptor.reset();
			var created = descriptor.createViews($container); // return view or array of views
			var views = _.isArray(created) ? created : [created];
			var elements = [];
			for (var i = 0, l = views.length; i < l; i++) {
				var view = views[i];
				if (!view) {
					throw new Error("Child view instance not created for " + descriptor.name);
				}
				if (this.parentView.onCreateChildView)
					this.parentView.onCreateChildView.call(this.parentView, view);
				view.render();
				if (descriptor.onRender)
					descriptor.onRender.call(this.parentView, view);
				elements.push(view.el);
			}
			//			if (descriptor.displayType == "append") {
			//				$(elements).appendTo($container);
			//				_.each(views, function (v) {
			//					// call ready function after element added to DOM
			//					if (_.isFunction(v.ready)) v.ready.call(v);
			//				});
			//			}


			return created;
		},

		activeChildViews: function () {
			var views = [];
			_.each(this.childViewDescriptors, function (descriptor) {
				if (descriptor.active) {
					views.push.apply(views, descriptor.active);
				};
			});
			return views;
		},

		getCreatedChildViews: function (name) {
			var descriptor = this.childViewDescriptorsByName[name];
			if (!descriptor) {
				throw new Error("No child views defined with the name " + name);
			}
			var created = descriptor.created;
			if (_.isNull(created)) {
				throw new Error("Child views have not yet been created for child view " + name + ". Child view instances can only be accessed after they have been rendered");
			}
			return created;
		},

		close: function () {
			_.each(this.childViewDescriptors, function (descriptor) {
				descriptor.reset();
			});
		}
	});


	// Define a scope for extensions
	var root = this;
	root.Backbone.easyext = root.Backbone.easyext || {};
	root.Backbone.easyext.views = {
		ChildViewHelper: ChildViewHelper
	};
})();
