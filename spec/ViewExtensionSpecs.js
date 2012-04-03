describe("Child View Management", function () {

	var BaseView = Backbone.View.extend({
		// Renders child views specified by this view's childViews property, either all 
		// or just those specified as arguments renderChildViews("apples", "pears")
		renderChildViews: function () {
			var helper = this.childViewHelper || (this.childViewHelper = new Backbone.easyext.views.ChildViewHelper(this));
			return helper.render.apply(helper, arguments);
		}
	});

	describe("when rendering child views", function () {

		var ParentView = BaseView.extend({

			childViews: function () {
				return {
					child1: { view: Child, options: { message: "child1" } },
					child2: { view: Child, options: { message: "child2" } }
				};
			},

			render: function () {
				this.renderChildViews();
			}
		});

		var Child = BaseView.extend({
			render: function () {
				this.$el.append('child-' + this.options.message);
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

		it("rendering parent view should render child views into parent element", function () {
			parent.render();
			expect(parent.$el.children('[data-childview="child1"]').html()).toEqual("child-child1");
			expect(parent.$el.children('[data-childview="child2"]').html()).toEqual("child-child2");
		});
	});

});
