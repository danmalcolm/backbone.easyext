describe("Child View Management", function () {

	// Configuration and view supertype for a typical application	
	var BaseView = Backbone.View.extend({

		attachChildViews: function () {
			var helper = this.childViewHelper || (this.childViewHelper = new Backbone.easyext.views.ChildViewHelper(this));
			return helper.attach.apply(helper, arguments);
		},

		close: function () {
			this.unbind();
			if (this.childViewHelper) this.childViewHelper.cleanUp();
			this.remove();
			this.closed = true;
		},

		render: function () {
			// Most tests specify $el directly, but note that renderChildViews
			// should be called after the content of $el has been generated. 
			this.attachChildViews();
		}
	});

	Backbone.easyext.views.configureChildViews({
		// hook for cleaning up a detached child view
		cleanUpView: function (view) {
			view.close();
		}
	});

	var createParent = function (options, childViews, html) {

		var ParentView = BaseView.extend({
			childViews: childViews
		});
		options || (options = {});
		options.el = $(html);
		var parent = new ParentView(options);
		return parent;
	};

	var ChildView = BaseView.extend({
		render: function () {
			this.$el.append('ChildView - message:' + this.options.message);
			return this;
		}
	});

	var ChildViewUsingModel = BaseView.extend({
		render: function () {
			this.$el.append('ChildView - message:' + this.options.message + ', name:' + this.model.get("name"));
			return this;
		}
	});



	describe("Child view configuration", function () {

		describe("when attaching single child views to elements specified via default data-childview selector", function () {

			var parent;
			beforeEach(function () {
				var html = '<div>'
			+ '<h1>Parent</h1>\n'
			+ '<div data-childview="child1"></div>\n'
			+ '<div data-childview="child2"></div>\n'
			+ '</div>';
				var childViews = {
					child1: { view: ChildView, options: { message: "I am child 1"} },
					child2: { view: ChildView, options: { message: "I am child 2"} }
				};
				parent = createParent({}, childViews, html);
			});

			it("should create each child view, attached to container element", function () {
				parent.render();
				expect(parent.$el.children('[data-childview="child1"]').text()).toStartWith("ChildView - message:I am child 1");
				expect(parent.$el.children('[data-childview="child2"]').text()).toStartWith("ChildView - message:I am child 2");
			});

		});

		describe("when attaching single child views to multiple elements using function to vary options", function () {

			var parent;
			beforeEach(function () {
				var html = '<div>'
			+ '<h1>Parent</h1>\n'
			+ '<div data-childview="child1" data-message="I am instance 1"></div>\n'
			+ '<div data-childview="child1" data-message="I am instance 2"></div>\n'
			+ '</div>';
				var childViews = {
					child1: {
						view: ChildView, 
						options: function ($el) { return { message: $el.data("message") }; } 
					}
				};
				parent = createParent({}, childViews, html);
			});

			it("should create each child view, attached to container element with customised options", function () {
				parent.render();
				var $elements = parent.$el.children('[data-childview="child1"]');
				expect($elements.eq(0).text()).toStartWith("ChildView - message:I am instance 1");
				expect($elements.eq(1).text()).toStartWith("ChildView - message:I am instance 2");
			});

		});

		describe("when attaching single child views to elements specified via custom selector", function () {

			var parent;
			beforeEach(function () {
				var html = '<div>'
			+ '<h1>Parent</h1>\n'
			+ '<div class="child1"></div>\n'
			+ '<div class="child2"></div>\n'
			+ '</div>';
				var childViews = {
					child1: { view: ChildView, selector: '[class=child1]', options: { message: "I am child 1"} },
					child2: { view: ChildView, selector: '[class=child2]', options: { message: "I am child 2"} }
				};
				parent = createParent({}, childViews, html);
			});

			it("should create each child view, attached to container element", function () {
				parent.render();
				expect(parent.$el.children('[class=child1]').text()).toStartWith("ChildView - message:I am child 1");
				expect(parent.$el.children('[class=child2]').text()).toStartWith("ChildView - message:I am child 2");
			});

		});

		describe("when attaching sequence of child views generated via options within element specified via default data-childview selector", function () {

			var parent;
			beforeEach(function () {
				var html = '<div>'
			+ '<h1>Parent</h1>\n'
			+ '<div data-childview="children"></div>\n'
			+ '</div>';
				// Multiple child views created if array of options specified
				var childViews = {
					children: {
						view: ChildView,
						options: [{ message: "1a" }, { message: "1b" }, { message: "1c"}]
					}
				};
				parent = createParent({}, childViews, html);
			});

			it("should attach each child view, appended to its container element", function () {
				parent.render();
				var expected = "<div>ChildView - message:1a</div><div>ChildView - message:1b</div><div>ChildView - message:1c</div>";
				expect(parent.$el.children('[data-childview="children"]').html()).toEqual(expected);
			});

		});

		describe("when attaching sequence of child views generated via collection attribute from parent view's model", function () {

			var parent;
			beforeEach(function () {
				var html = '<div>'
			+ '<h1>Parent</h1>\n'
			+ '<div data-childview="children"></div>\n'
			+ '</div>';
				// Parent view with model containing collection attribute
				var parentOptions = {
					model: new Backbone.Model({
						myCollection: new Backbone.Collection([{ name: "a" }, { name: "b" }, { name: "c"}])
					})
				};
				var childViews = {
					children: { view: ChildViewUsingModel, options: { message: "hi" }, collection: "myCollection" }
				};

				parent = createParent(parentOptions, childViews, html);
			});

			it("should attach each child view, appended to its container element", function () {
				parent.render();
				var expected = "<div>ChildView - message:hi, name:a</div><div>ChildView - message:hi, name:b</div><div>ChildView - message:hi, name:c</div>";
				expect(parent.$el.children('[data-childview="children"]').html()).toEqual(expected);
			});

		});

	});


	describe("Child view access and disposal", function () {

		describe("when attaching single child views", function () {

			var parent;
			beforeEach(function () {
				var html = '<div>'
			+ '<h1>Parent</h1>\n'
			+ '<div data-childview="child1"></div>\n'
			+ '<div data-childview="child2"></div>\n'
			+ '</div>';
				var childViews = {
					child1: { view: ChildView, options: { message: "I am child 1"} },
					child2: { view: ChildView, options: { message: "I am child 2"} }
				};
				parent = createParent({}, childViews, html);
			});

			it("should allow retrieval of child view instances", function () {
				parent.render();
				// Using helper directly - 	TODO - add getChildView(s) methods to view via mixin or leave up to applications?
				var child = parent.childViewHelper.getChildView("child1");
				expect(child).not.toBeUndefined();
				expect(child.options.message).toEqual("I am child 1");
			});

			it("should throw if attempting to retrieve using method used for sequence of views", function () {
				parent.render();
				//TODO
			});

			it("should clean up child views when cleaning up parent view", function () {
				parent.render();
				var child1 = parent.childViewHelper.getChildView("child1");
				var child2 = parent.childViewHelper.getChildView("child2");
				parent.close();
				expect(child1.closed).toBeTruthy();
				expect(child2.closed).toBeTruthy();
			});
		});


		describe("when attaching single child view to multiple containers", function () {

			var parent;
			beforeEach(function () {
				var html = '<div>'
			+ '<h1>Parent</h1>\n'
			+ '<div data-childview="child1"></div>\n'
			+ '<div data-childview="child1"></div>\n'
			+ '</div>';
				var childViews = {
					child1: { view: ChildView, options: { message: "I am child 1"} }
				};
				parent = createParent({}, childViews, html);
			});

			it("retrieving child view without indexer should return first", function () {
				parent.render();
				var child = parent.childViewHelper.getChildView("child1");
				expect(child).not.toBeUndefined();
				expect(child.options.message).toEqual("I am child 1");
			});

			it("should allow retrieval of child view instances using indexer", function () {
				parent.render();
				// Using helper directly - 	TODO - add getChildView(s) methods to view via mixin or leave up to applications?
				var instance1 = parent.childViewHelper.getChildView("child1", 0);
				expect(instance1).not.toBeUndefined();
				expect(instance1.options.message).toEqual("I am child 1");

				var instance2 = parent.childViewHelper.getChildView("child1", 1);
				expect(instance2).not.toBeUndefined();
				expect(instance2.options.message).toEqual("I am child 1");
			});

			it("should throw if attempting to retrieve using method used for sequence of views", function () {
				parent.render();
				//TODO
			});

			it("should clean up child views when cleaning up parent view", function () {
				parent.render();
				var child1 = parent.childViewHelper.getChildView("child1", 0);
				var child2 = parent.childViewHelper.getChildView("child1", 1);
				parent.close();
				expect(child1.closed).toBeTruthy();
				expect(child2.closed).toBeTruthy();
			});
		});

		describe("when attaching sequence of child views", function () {

			var parent;
			beforeEach(function () {
				var html = '<div>'
			+ '<h1>Parent</h1>\n'
			+ '<div data-childview="children"></div>\n'
			+ '</div>';
				var childViews = {
					children: {
						view: ChildView,
						options: [{ message: "1a" }, { message: "1b" }, { message: "1c"}]
					}
				};
				parent = createParent({}, childViews, html);
			});

			it("should allow retrieval of child view instances", function () {
				parent.render();
				var children = parent.childViewHelper.getChildViews("children");
				expect(children.length).toEqual(3);
				expect(children[0]).toBeInstanceOf(ChildView);
				expect(children[1]).toBeInstanceOf(ChildView);
				expect(children[2]).toBeInstanceOf(ChildView);
			});

			it("should throw if attempting to retrieve using method used for single view", function () {
				parent.render();
				//TODO
			});

			it("should clean up children when cleaning up parent", function () {
				parent.render();
				var children = parent.childViewHelper.getChildViews("children");
				parent.close();
				expect(children[0].closed).toBeTruthy();
				expect(children[1].closed).toBeTruthy();
				expect(children[2].closed).toBeTruthy();
			});
		});

	});


	/*
	describe("when attaching multiple child views generated via collection", function () {

	var parent;
	beforeEach(function () {
	var html = '<div>'
	+ '<h1>Parent</h1>\n'
	+ '<div data-childviews="child1"></div>\n'
	+ '</div>';
	var childViews = {
	child1: {
	view: ChildView,
	options: { message: "I am child 1" },
	collection: "List"
	}
	};
	parent = createParent({}, childViews, html);
	});

	it("should create each child view, attached to its container element", function () {
	parent.render();
	expect(parent.$el.children('[data-childview="child1"]').text()).toStartWith("ChildView - message:I am child 1");
	});

	it("should allow retrieval of child view instances", function () {
	parent.render();
	// Using helper directly - 	TODO - add getChildView(s) methods to view via mixin or leave up to applications?
	var child = parent.childViewHelper.getChildView("child1");
	expect(child).not.toBeUndefined();
	expect(child.options.message).toEqual("I am child 1");
	});

	it("should clean up child views when cleaning up parent view", function () {
	parent.render();
	var child1 = parent.childViewHelper.getChildView("child1");
	parent.close();
	expect(child1.closed).toBeTruthy();
	});
	});
	*/

});
