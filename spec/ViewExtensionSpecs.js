describe("Child View Management", function () {

	// Configuration and view supertype for a typical application	
	var BaseView = Backbone.View.extend({

		// custom clean-up / disposal logic to ensure 
		close: function () {
			this.unbind();
			if (this.childViewHelper) this.childViewHelper.cleanUp();
			this.remove();
			this.closed = true;
		},

		render: function () {
			// attachChildViews should be called after the view's element ($el)
			// content has been generated (perhaps by loading and populating a
			// template). These tests set the $el content directly when creating
			// views making it ready for child views to be attached.
			this.attachChildViews();
		}
	});

	// Extend with ChildView management functionality
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


	describe("Child view configuration and attachment", function () {

		describe("when attaching child views to elements specified via default data-childview selector", function () {

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

		describe("when restricting child views to attach", function () {

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
				parent.render = function () {
					this.attachChildViews("child1");
				};
			});

			it("should attach named view", function () {
				parent.render();
				expect(parent.$el.children('[data-childview="child1"]').text()).toStartWith("ChildView - message:I am child 1");
			});

			it("should not attach other views", function () {
				parent.render();
				expect(parent.$el.children('[data-childview="child2"]').text()).toEqual("");
			});


		});

		describe("when attaching single child view type to multiple elements using function to customise options", function () {

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

		describe("when attaching child views to elements specified via custom selector", function () {

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

	});

	describe("Child view sequence configuration", function () {

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
							// initial returns all but last model in collection
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

		var html = '<div>'
			+ '<h1>Parent</h1>\n'
			+ '<div data-childview="child1"></div>\n'
			+ '</div>';

		describe("when specifying that child should use all parent view's options", function () {

			var parent, child;
			beforeEach(function () {
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

			it("child view options should not include parent view's el", function () {
				expect(child.options.el).not.toBe(parent.options.el);
			});

		});

		describe("when specifying attribute of parent view's model to populate child view's model", function () {

			var parent, child;
			beforeEach(function () {
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

		describe("when specifying attribute of parent view's model to populate child view's collection", function () {

			var parent, child;
			beforeEach(function () {
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

		var parent;

		function accessFnsShouldThrow() {
			var childViewName = arguments[0];
			var fnNames = _.tail(arguments);
			_.each(fnNames, function (fnName) {
				it("should not be valid to use " + fnName, function () {
					expect(typeof parent[fnName]).toBe("function");
					var test = function () {
						parent[fnName](childViewName);
					};
					expect(test).toThrow();
				});
			}, this);
		}

		describe("when accessing child views attached to single elements", function () {

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
				parent.render();
			});

			it("getChildView should retrieve single child view instance", function () {
				var child = parent.getChildView("child1");
				expect(child).not.toBeUndefined();
				expect(child.options.message).toEqual("I am child 1");
			});

			it("getChildViews should retrieve array containing single child view instance", function () {
				var children = parent.getChildViews("child1");
				expect(children.length).toEqual(1);
				expect(children[0].options.message).toEqual("I am child 1");
			});

			accessFnsShouldThrow("child1", "getChildViewSequence", "getChildViewSequences");

			it("should clean up child views when cleaning up parent view", function () {
				var child1 = parent.getChildView("child1");
				var child2 = parent.getChildView("child2");
				parent.close();
				expect(child1.closed).toBeTruthy();
				expect(child2.closed).toBeTruthy();
			});
		});


		describe("when attaching child views attached to multiple elements", function () {

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
				parent.render();
			});

			it("should allow retrieval using getChildViews", function () {
				var instances = parent.getChildViews("child1");
				expect(instances.length).toEqual(2);
				expect(instances[0].options.message).toEqual("I am child 1");
				expect(instances[1].options.message).toEqual("I am child 1");
			});

			accessFnsShouldThrow("child1", "getChildView", "getChildViewSequence", "getChildViewSequences");

			it("should clean up child views when cleaning up parent view", function () {
				var children = parent.getChildViews("child1");
				parent.close();
				expect(_.pluck(children, "closed")).toEqual([true, true]);
			});
		});

		describe("when attaching sequence of child views", function () {

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
				parent.render();
			});

			it("should allow retrieval of child view instances", function () {
				parent.render();
				var children = parent.childViewHelper.getChildViewSequence("children");
				expect(children.length).toEqual(3);
				expect(children[0]).toBeInstanceOf(ChildView);
				expect(children[1]).toBeInstanceOf(ChildView);
				expect(children[2]).toBeInstanceOf(ChildView);
			});

			accessFnsShouldThrow("child1", "getChildView", "getChildViews");

			it("should clean up children when cleaning up parent", function () {
				var children = parent.childViewHelper.getChildViewSequence("children");
				parent.close();
				expect(_.pluck(children, "closed")).toEqual([true, true, true]);
			});
		});

	});
});
