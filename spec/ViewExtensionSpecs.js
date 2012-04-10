describe("Child View Management", function () {

	// Configuration and view supertype for a typical application	
	var BaseView = Backbone.View.extend({

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
	_.extend(BaseView.prototype, Backbone.easyext.views.ChildViews);

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



	describe("Child view configuration and rendering", function () {

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

		describe("when attaching single child view to elements specified via custom selector", function () {

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
			+ '<div data-childview="children1"></div>\n'
			+ '</div>';
				// Multiple child views specified via sequence option
				var childViews = {
					children1: {
						view: ChildView,
						sequence: { options: [{ message: "1a" }, { message: "1b" }, { message: "1c"}] }
					}
				};
				parent = createParent({}, childViews, html);
			});

			it("should attach each child view, appended to its container element", function () {
				parent.render();
				var expected = "<div>ChildView - message:1a</div><div>ChildView - message:1b</div><div>ChildView - message:1c</div>";
				expect(parent.$el.children('[data-childview="children1"]').html()).toEqual(expected);
			});

		});

		describe("when attaching sequence of child views generated via collection attribute from parent view's model", function () {

			var parent;
			beforeEach(function () {
				var html = '<div>'
			+ '<h1>Parent</h1>\n'
			+ '<div data-childview="children1"></div>\n'
			+ '</div>';
				// Parent view with model containing collection attribute
				var parentOptions = {
					model: new Backbone.Model({
						myCollection: new Backbone.Collection([{ name: "a" }, { name: "b" }, { name: "c"}])
					})
				};
				var childViews = {
					children1: {
						view: ChildViewUsingModel,
						options: { message: "hi" },
						sequence: { collection: "myCollection" }
					}
				};

				parent = createParent(parentOptions, childViews, html);
			});

			it("should attach each child view, appended to its container element", function () {
				parent.render();
				var expected = "<div>ChildView - message:hi, name:a</div><div>ChildView - message:hi, name:b</div><div>ChildView - message:hi, name:c</div>";
				expect(parent.$el.children('[data-childview="children1"]').html()).toEqual(expected);
			});

		});

		describe("when attaching sequence of child views generated via models option", function () {

			var parent;
			beforeEach(function () {
				var html = '<div>'
			+ '<h1>Parent</h1>\n'
			+ '<div data-childview="children1"></div>\n'
			+ '</div>';
				// Parent view with model containing collection attribute
				var parentOptions = {
					model: new Backbone.Model({
						myCollection: new Backbone.Collection([{ name: "a" }, { name: "b" }, { name: "c"}])
					})
				};
				var childViews = function () {
					return {
						children1: {
							view: ChildViewUsingModel,
							options: { message: "hi" },
							// first 2 models in the collection
							sequence: { models: this.model.get("myCollection").initial() }
						}
					};
				};

				parent = createParent(parentOptions, childViews, html);
			});

			it("should attach each child view, appended to its container element", function () {
				parent.render();
				var expected = "<div>ChildView - message:hi, name:a</div><div>ChildView - message:hi, name:b</div>";
				expect(parent.$el.children('[data-childview="children1"]').html()).toEqual(expected);
			});

		});


	});


	describe("Child view options configuration", function () {

		describe("when specifying that child should use all parent view's options", function () {

			var parent, child;
			beforeEach(function () {
				var html = '<div>'
			+ '<h1>Parent</h1>\n'
			+ '<div data-childview="child1"></div>\n'
			+ '</div>';
				var childViews = {
					child1: { view: ChildView, parentOptions: "*", options: { option3: "custom"} }
				};
				parent = createParent({
					option1: "option 1",
					option2: "option 2",
					option3: "option 3"
				}, childViews, html);
				parent.render();
				child = parent.getChildView("child1");

			});

			it("child view options should include all options from parent", function () {
				expect(child.options.option1).toEqual(parent.options.option1);
				expect(child.options.option2).toEqual(parent.options.option2);
			});

			it("options defined for child view should override any values specified on parent", function () {
				expect(child.options.option3).toEqual("custom");
			});

		});

		describe("when specifying attribute to populate child view's model", function () {

			var parent, child;
			beforeEach(function () {
				var html = '<div>'
			+ '<h1>Parent</h1>\n'
			+ '<div data-childview="child1"></div>\n'
			+ '</div>';
				var childViews = {
					child1: { view: ChildView, model: "myModel" }
				};
				var model = new Backbone.Model({
					"myModel": new Backbone.Model({})
				});
				parent = createParent({
					model: model
				}, childViews, html);
				parent.render();
				child = parent.getChildView("child1");
			});

			it("child view model should be set from attribute belonging to parent view's model", function () {
				expect(child.model).toBe(parent.model.get("myModel"));
			});

		});

		describe("when specifying attribute to populate child view's collection", function () {

			var parent, child;
			beforeEach(function () {
				var html = '<div>'
			+ '<h1>Parent</h1>\n'
			+ '<div data-childview="child1"></div>\n'
			+ '</div>';
				var childViews = {
					child1: { view: ChildView, collection: "myCollection" }
				};
				var model = new Backbone.Model({
					"myCollection": new Backbone.Collection()
				});
				parent = createParent({
					model: model
				}, childViews, html);
				parent.render();
				child = parent.getChildView("child1");
			});

			it("child view collection should be set from attribute belonging to parent view's model", function () {
				expect(child.collection).toBe(parent.model.get("myCollection"));
			});

		});

		describe("when specifying that child should use specific parent view's options", function () {

			var parent, child;
			beforeEach(function () {
				var html = '<div>'
			+ '<h1>Parent</h1>\n'
			+ '<div data-childview="child1"></div>\n'
			+ '</div>';
				var childViews = {
					child1: { view: ChildView, parentOptions: "option1 option2 option3", options: { option3: "custom"} }
				};
				parent = createParent({
					option1: "option 1",
					option2: "option 2",
					option3: "option 3",
					option4: "option 4"
				}, childViews, html);
				parent.render();
				child = parent.getChildView("child1");

			});

			it("child view options should include specified options from parent", function () {
				expect(child.options.option1).toEqual(parent.options.option1);
				expect(child.options.option2).toEqual(parent.options.option2);
			});

			it("options defined for child view should override any values specified on parent", function () {
				expect(child.options.option3).toEqual("custom");
			});

			it("should not use any options not specified", function () {
				expect(child.options.option4).toBeUndefined();
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
				var child = parent.getChildView("child1");
				expect(child).not.toBeUndefined();
				expect(child.options.message).toEqual("I am child 1");
			});

			it("should throw if attempting to retrieve using method used for sequence of views", function () {
				parent.render();
				//TODO
			});

			it("should clean up child views when cleaning up parent view", function () {
				parent.render();
				var child1 = parent.getChildView("child1");
				var child2 = parent.getChildView("child2");
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
				var child = parent.getChildView("child1");
				expect(child).not.toBeUndefined();
				expect(child.options.message).toEqual("I am child 1");
			});

			it("should allow retrieval of child view instances using indexer", function () {
				parent.render();
				// Using helper directly - 	TODO - add getChildView(s) methods to view via mixin or leave up to applications?
				var instance1 = parent.getChildView("child1", 0);
				expect(instance1).not.toBeUndefined();
				expect(instance1.options.message).toEqual("I am child 1");

				var instance2 = parent.getChildView("child1", 1);
				expect(instance2).not.toBeUndefined();
				expect(instance2.options.message).toEqual("I am child 1");
			});

			it("should throw if attempting to retrieve using method used for sequence of views", function () {
				parent.render();
				//TODO
			});

			it("should clean up child views when cleaning up parent view", function () {
				parent.render();
				var child1 = parent.getChildView("child1", 0);
				var child2 = parent.getChildView("child1", 1);
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
						sequence: { options: [{ message: "1a" }, { message: "1b" }, { message: "1c"}] }
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


});
