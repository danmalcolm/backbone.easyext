describe("ModelExtensionSpecs", function () {

	describe("Dirty Tracking", function () {

		// Demo models

		// Adding dirty tracking functionality to a model supertype
		// is probably the best way to add dirty tracking functionality 
		// to your application

		var Model = Backbone.Model.extend({
			constructor: function () {
				Backbone.Model.prototype.constructor.apply(this, arguments);
				// Extend model with dirty tracking functionality
				Backbone.easyext.models.DirtyTracker.extendModel(this);
			}
		});

		var Product = Model.extend({});

		var Review = Model.extend({});

		var ReviewCollection = Backbone.Collection.extend({
			model: Review,
			comparator: function (model) {
				return model.id;
			}
		});
		
		var product;

		var simulateSuccessfulSync = function (data) {
			spyOn(Backbone, 'sync').andCallFake(function (method, model, options) {
				options.success(data);
			});
		};

		describe("when testing simple model", function () {

			beforeEach(function () {
				product = new Product({
					id: 123456,
					code: "apple",
					name: "Apple"
				});
			});

			it("should not be be dirty if no changes have been made", function () {
				expect(product.isDirty()).toBeFalsy();
			});

			it("should be dirty if attribute has changed", function () {
				product.set("name", "New Name!");
				expect(product.isDirty()).toBeTruthy();
			});

			it("should not be dirty if attribute has been changed and then been reverted to original", function () {
				product.set("name", "New Name!");
				product.set("name", "Apple");
				expect(product.isDirty()).toBeFalsy();
			});

			it("should not be dirty after changes saved via sync", function () {
				product.set("name", "New Name!");
				simulateSuccessfulSync({
					id: 123456,
					code: "apple",
					name: "Apple"
				});
				product.save();
				expect(product.isDirty()).toBeFalsy();
			});

			it("should not be dirty after changes overwritten by fetch, triggering sync event", function () {
				product.set("name", "New Name!");
				simulateSuccessfulSync({
					id: 123456,
					code: "apple",
					name: "Apple2"
				});
				// Note: no event fired by backbone after fetch, so we need to manually trigger event.
				// We're choosing to reuse "sync" event here, as it reflects a sync between model and 
				// server data (just opposite direction to save)
				product.fetch({ success: function () { product.trigger("sync"); } });
				expect(product.isDirty()).toBeFalsy();
			});
		});
		
		describe("when testing model with nested collection", function () {
			var review1, review2;
			beforeEach(function () {
				var reviews = [
					new Review({ id: 8879, user: "Dave", comments: "They are very nice" }),
					new Review({ id: 9899, user: "Mike", comments: "I agree" })
				];
				product = new Product({
					id: 123456,
					code: "apple",
					name: "Apple",
					reviews: new ReviewCollection(reviews)
				});
				review1 = product.get("reviews").at(0);
				review2 = product.get("reviews").at(1);
			});

			it("should not be be dirty if no changes have been made", function () {
				expect(product.isDirty()).toBeFalsy();
			});

			it("should be dirty if attribute of model in collection has changed", function () {
				review1.set("comments", "New!!!!");
				expect(product.isDirty()).toBeTruthy();
			});

			it("should not be dirty if attribute of model in collection has been changed then reverted to original", function () {
				var original = review1.get("comments");
				review1.set("comments", "New!!!!");
				review1.set("comments", original);
				expect(product.isDirty()).toBeFalsy();
			});

			it("should be dirty if new model added to collection", function () {
				product.get("reviews").add(new Review({ user: "Joe", comments: "I prefer pears" }));
				expect(product.isDirty()).toBeTruthy();
			});

			it("should be dirty if model removed from collection", function () {
				product.get("reviews").remove(review1);
				expect(product.isDirty()).toBeTruthy();
			});

			it("should not be dirty if removing, then adding model back to collection maintaining previous model order", function () {
				product.get("reviews").remove(review1);
				product.get("reviews").add(review1);
				expect(product.isDirty()).toBeFalsy();
			});
			
			it("should be dirty if removing, then adding model back to collection results in change to model order", function () {
				product.get("reviews").comparator = null;
				product.get("reviews").remove(review1);
				product.get("reviews").add(review1);
				expect(product.isDirty()).toBeTruthy();
			});

			it("should not be dirty if new model added, then removed from collection", function () {
				var review = new Review({ user: "Joe", comments: "I prefer pears" });
				product.get("reviews").add(review);
				product.get("reviews").remove(review);
				expect(product.isDirty()).toBeFalsy();
			});
		});
	});


	describe("AttributeConversion", function () {

		// Extend a base model type for test models
		var Model = Backbone.Model.extend(Backbone.easyext.models.AttributeConversion);

		describe("model attribute conversion", function () {

			var Order = Model.extend({
				attributeConversion: function () {
					return {
						customer: { model: Customer }
					};
				},
				correlationAttrs: ["date"]
			});
			var Customer = Model.extend({
				correlationAttrs: ["email"]
			});

			describe("when creating parent", function () {

				var order = new Order({
					id: 1233,
					customer: { name: "Tom", email: "tom@horseenthusiastmagazine.com" },
					date: new Date(2012, 1, 1),
					origin: "web"
				});

				it("should convert child attribute to model", function () {
					expect(order.get("customer") instanceof Customer).toBeTruthy();
					expect(order.get("customer").get("name")).toEqual("Tom");
				});

				it("should not convert other attributes", function () {
					expect(order.get("origin")).toEqual("web");
				});

			});

			describe("when updating attributes with data from server", function () {

				describe("when child is non-persistent and data contains persistent child data for same model", function () {
					// After sync, data from server will contain id value
					var order = new Order({
						id: 1233,
						customer: { name: "Tom", email: "tom@horseenthusiastmagazine.com" },
						date: new Date(2012, 1, 1),
						origin: "web"
					});
					var originalChild = order.get("customer");
					order.set({
						id: 1233,
						customer: { id: 23543, name: "Tom", email: "tom@horseenthusiastmagazine.com" },
						date: new Date(2012, 1, 1),
						origin: "web"
					});

					it("should not replace child model instance", function () {
						expect(order.get("customer")).toBe(originalChild);
					});

					it("should update child model attributes", function () {
						expect(order.get("customer").get("id")).toEqual(23543);
					});

				});

				describe("when child is non-persistent and data contains persistent child data for a different model", function () {
					// Fetch could retrieve background changes
					var order = new Order({
						id: 1233,
						customer: { name: "Tom", email: "tom@horseenthusiastmagazine.com" },
						date: new Date(2012, 1, 1),
						origin: "web"
					});
					var originalChild = order.get("customer");
					order.set({
						id: 28373,
						customer: { id: 23571, name: "Jim", email: "jim@hossenthusiastmagazine.com" },
						date: new Date(2012, 1, 1),
						origin: "web"
					});

					it("should replace child model instance", function () {
						expect(order.get("customer")).not.toBe(originalChild);
					});

					it("should set child model attributes", function () {
						expect(order.get("customer").get("id")).toEqual(23571);
					});

				});

				describe("when child is persistent and data contains persistent data for same model", function () {
					var order = new Order({
						id: 28373,
						customer: { id: 23543, name: "Tom", email: "tom@horseenthusiastmagazine.com" },
						date: new Date(2012, 1, 1),
						origin: "web"
					});
					var originalChild = order.get("customer");
					originalChild.set("name", "Tommy");
					order.set({
						id: 28373,
						customer: { id: 23543, name: "Tom", email: "tom@horseenthusiastmagazine.com" },
						date: new Date(2012, 1, 1),
						origin: "web"
					});

					it("should retain child model instance", function () {
						expect(order.get("customer")).toBe(originalChild);
					});

					it("should update attributes of child model", function () {
						expect(order.get("customer").get("name")).toEqual("Tom");
					});

				});

				describe("when child is persistent and data contains persistent data for different model", function () {

					var order = new Order({
						id: 28373,
						customer: { id: 23543, name: "Tom", email: "tom@horseenthusiastmagazine.com" },
						date: new Date(2012, 1, 1),
						origin: "web"
					});
					var originalChild = order.get("customer");
					order.set({
						id: 28373,
						customer: { id: 23571, name: "Jim", email: "jim@hossenthusiastmagazine.com" },
						date: new Date(2012, 1, 1),
						origin: "web"
					});

					it("should not retain child model instance", function () {
						expect(order.get("customer")).not.toBe(originalChild);
					});

					it("should update attributes of child model", function () {
						expect(order.get("customer").get("name")).toEqual("Jim");
					});

				});

			});
		});

		describe("collection attributes", function () {

			var Order = Model.extend({
				attributeConversion: function () {
					return {
						lines: { collection: OrderLineCollection }
					};
				},
				correlationAttrs: ["date"]
			});
			var OrderLine = Model.extend({
				attributeConversion: function () {
					return {
						product: { model: Product }
					};
				},
				correlationAttrs: ["product", "quantity"]
			});
			var OrderLineCollection = Backbone.Collection.extend({
				model: OrderLine,
				initialize: function (models, options) {
					this.parent = options.parent;
				}

			});
			var Product = Backbone.Model.extend({
				correlationAttrs: ["ean"]
			});

			describe("when creating parent", function () {

				var order = new Order({
					lines: [{ product: { id: 335, ean: "1234561234569", name: "Apple" }, quantity: 1 },
					{ product: { id: 335, ean: "3211561234569", name: "Pear" }, quantity: 2}]
				});

				it("should convert array to collection", function () {
					expect(order.get("lines") instanceof OrderLineCollection).toBeTruthy();
				});

				it("should include reference to parent in collection options", function () {
					expect(order.get("lines").parent).toBe(order);
				});

				it("should convert models in collection from array elements", function () {
					expect(order.get("lines").at(0).get("product").get("name")).toEqual("Apple");
					expect(order.get("lines").at(1).get("product").get("name")).toEqual("Pear");
				});
			});

			describe("when updating attributes with data from server", function () {

				describe("when collection models are non-persistent and data contains persistent data for same models", function () {
					// After sync, data from server will contain id values
					var order = new Order({
						lines: [
							{ product: { id: 335, ean: "1234561234569", name: "Apple" }, quantity: 1 },
							{ product: { id: 335, ean: "3211561234569", name: "Pear" }, quantity: 2 }
						]
					});
					var originalCollection = order.get("lines");
					var originalModels = originalCollection.models.slice(0);
					order.set({
						lines: [
							{ id: 13344, product: { id: 335, ean: "1234561234569", name: "Apple" }, quantity: 1 },
							{ id: 13345, product: { id: 335, ean: "3211561234569", name: "Pear" }, quantity: 2 }
						]
					});

					it("should retain original collection instance", function () {
						expect(order.get("lines")).toBe(originalCollection);
					});

					it("should retain original models in collection", function () {
						expect(_.pluck(order.get("lines").models, "cid")).toEqual(_.pluck(originalModels, "cid"));
					});

					it("should set attributes of models in collection", function () {
						var lines = order.get("lines");
						expect(lines.at(0).id).toEqual(13344);
						expect(lines.at(1).id).toEqual(13345);
					});

				});

			});

		});

		describe(".net date value attributes", function () {

			var Order = Model.extend({
				attributeConversion: function () {
					return {
						date: { value: ".netjsondate" }
					};
				}
			});

			describe("when setting value", function () {
				it("should convert serialized date value to date", function () {
					var order = new Order({ date: "/Date(1325590229000)/" }); //Jan 03 2012 11:30:29
					expect(order.get("date")).toEqual(new Date(1325590229000));
				});
				it("should not convert invalid format value to date", function () {
					var order = new Order({ date: "/Date(XXXX)/" }); //Jan 03 2012 11:30:29
					expect(order.get("date")).toEqual("/Date(XXXX)/");
				});
			});
		});


	});
});