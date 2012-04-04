describe("Child View Management", function () {

	// Configuration and view supertype for a typical application	
	var BaseView = Backbone.View.extend({

		renderChildViews: function () {
			var helper = this.childViewHelper || (this.childViewHelper = new Backbone.easyext.views.ChildViewHelper(this));
			return helper.render.apply(helper, arguments);
		},

		close: function () {
			this.unbind();
			if (this.childViewHelper) this.childViewHelper.cleanUp();
			this.remove();
			this.closed = true;
		}
	});

	Backbone.easyext.views.configureChildViews({
		cleanUpView: function (view) {
			view.close();
		}
	});
	
	describe("when rendering child views defined on parent", function () {

		var ParentView = BaseView.extend({

			childViews: function () {
				return {
					child1: { view: ChildView, options: { message: "I am child 1"} },
					child2: { view: ChildView, options: { message: "I am child 2"} }
				};
			},

			render: function () {
				this.renderChildViews();
			}
		});

		var ChildView = BaseView.extend({
			render: function () {
				this.$el.append('ChildView - message:' + this.options.message + ',cid:' + this.cid);
				return this;
			}
		});

		var parent;
		beforeEach(function () {
			var el = $('<div>'
			+ '<h1>Parent</h1>\n'
			+ '<div data-childview="child1"></div>\n'
			+ '<div data-childview="child2"></div>\n'
			+ '</div>');
			parent = new ParentView({ el: el });
		});

		it("should create each child view, attached to its container element", function () {
			parent.render();
			expect(parent.$el.children('[data-childview="child1"]').html()).toStartWith("ChildView - message:I am child 1");
			expect(parent.$el.children('[data-childview="child2"]').html()).toStartWith("ChildView - message:I am child 2");
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
			var child2 = parent.childViewHelper.getChildView("child1");
			parent.close();
			expect(child1.closed).toBeTruthy();
			expect(child2.closed).toBeTruthy();
		});
	});

});
