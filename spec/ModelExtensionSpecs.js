

describe("Dirty Tracking", function () {

	describe("Checking dirty state using DirtyTracker directly", function () {

		var simulateSuccessfulSync = function (data) {
			spyOn(Backbone, 'sync').andCallFake(function (method, model, options) {
				options.success(data);
			});
		};


		describe("when testing simple model", function () {

			var Product = Backbone.Model.extend({});

			var product, tracker;

			beforeEach(function () {
				product = new Product({
					id: 123456,
					code: "apple",
					name: "Apple"
				});
				tracker = new Backbone.easyext.models.DirtyTracker(product);
			});

			it("should not be be dirty if no changes have been made", function () {
				expect(tracker.isDirty()).toBeFalsy();
			});

			it("should be dirty if attribute has changed", function () {
				product.set("name", "New Name!");
				expect(tracker.isDirty()).toBeTruthy();
			});

			it("should not be dirty if attribute has been changed and then been reverted to original", function () {
				product.set("name", "New Name!");
				product.set("name", "Apple");
				expect(tracker.isDirty()).toBeFalsy();
			});

			it("should not be dirty after changes saved via sync", function () {
				product.set("name", "New Name!");
				simulateSuccessfulSync({
					id: 123456,
					code: "apple",
					name: "Apple"
				});
				product.save();
				expect(tracker.isDirty()).toBeFalsy();
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
				expect(tracker.isDirty()).toBeFalsy();
			});
		});

		describe("when testing model containing 2 levels of nested models", function () {

			var Product = Backbone.Model.extend({});
			var Manufacturer = Backbone.Model.extend({});
			var Person = Backbone.Model.extend({});

			var product, manufacturer, owner, tracker;

			beforeEach(function () {
				owner = new Person({ name: 'Mr John Smith' });
				manufacturer = new Manufacturer({ id: 345, name: "FruitMaster", owner: owner });
				product = new Product({
					id: 123456,
					code: "apple",
					name: "Apple",
					manufacturer: manufacturer
				});
				tracker = new Backbone.easyext.models.DirtyTracker(product);
			});

			it("should not be be dirty if no changes have been made", function () {
				expect(tracker.isDirty()).toBeFalsy();
			});

			it("should be dirty if attribute within deepest model has changed", function () {
				owner.set("name", "New Name!");
				expect(tracker.isDirty()).toBeTruthy();
			});

			it("should not be dirty if deepest model replaced with model with identical attributes", function () {
				manufacturer.set("owner", new Person(owner.attributes));
				expect(tracker.isDirty()).toBeFalsy();
			});
			
		});

		describe("when testing model with nested collection", function () {

			var Product = Backbone.Model.extend({});

			var Review = Backbone.Model.extend({});

			var ReviewCollection = Backbone.Collection.extend({
				model: Review,
				comparator: function (model) {
					return model.id;
				}
			});

			var product, review1, review2, tracler;
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
				tracker = new Backbone.easyext.models.DirtyTracker(product);
			});

			it("should not be be dirty if no changes have been made", function () {
				expect(tracker.isDirty()).toBeFalsy();
			});

			it("should be dirty if attribute of model in collection has changed", function () {
				review1.set("comments", "New!!!!");
				expect(tracker.isDirty()).toBeTruthy();
			});

			it("should not be dirty if attribute of model in collection has been changed then reverted to original", function () {
				var original = review1.get("comments");
				review1.set("comments", "New!!!!");
				review1.set("comments", original);
				expect(tracker.isDirty()).toBeFalsy();
			});

			it("should be dirty if new model added to collection", function () {
				product.get("reviews").add(new Review({ user: "Joe", comments: "I prefer pears" }));
				expect(tracker.isDirty()).toBeTruthy();
			});

			it("should be dirty if model removed from collection", function () {
				product.get("reviews").remove(review1);
				expect(tracker.isDirty()).toBeTruthy();
			});

			it("should not be dirty if removing, then adding different model back to collection with identical attributes", function () {
				product.get("reviews").remove(review1);
				product.get("reviews").add(new Review(review1.attributes));
				expect(tracker.isDirty()).toBeFalsy();
			});

			it("should not be dirty if removing, then adding model back to collection maintaining previous model order", function () {
				product.get("reviews").remove(review1);
				product.get("reviews").add(review1);
				expect(tracker.isDirty()).toBeFalsy();
			});

			it("should be dirty if removing, then adding model back to collection results in change to model order", function () {
				// no comparator means that items will not be sorted, so adding item will change order
				product.get("reviews").comparator = null;

				product.get("reviews").remove(review1);
				product.get("reviews").add(review1);
				expect(tracker.isDirty()).toBeTruthy();
			});

			it("should not be dirty if new model added, then removed from collection", function () {
				var review = new Review({ user: "Joe", comments: "I prefer pears" });
				product.get("reviews").add(review);
				product.get("reviews").remove(review);
				expect(tracker.isDirty()).toBeFalsy();
			});
		});
	});



	describe("Checking dirty state using model extension", function () {
		var Model = Backbone.Model.extend({
			constructor: function () {
				Backbone.Model.prototype.constructor.apply(this, arguments);
				// Extend model with dirty tracking functionality
				Backbone.easyext.models.DirtyTracker.extendModel(this);
			}
		});

		var Product = Model.extend({});

		beforeEach(function () {
			product = new Product({
				id: 123456,
				code: "apple",
				name: "Apple"
			});
		});

		it("should add isDirty method to model", function () {
			expect(typeof product.isDirty).toBe("function");
		});

		it("should not be be dirty if no changes have been made", function () {
			expect(product.isDirty()).toBeFalsy();
		});

		it("should be dirty if attribute has changed", function () {
			product.set("name", "New Name!");
			expect(product.isDirty()).toBeTruthy();
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
			correlationAttrs: ["date", "customer"]
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

	describe("custom collection attributes", function () {

		var Order = Model.extend({
			defaults: {
				lines: []
			},
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

			it("should convert nested models from models in collection", function () {
				expect(order.get("lines").at(0).get("product") instanceof Product).toBeTruthy();
			});
		});

		// Note that the models defaults property needs to be set to enable empty collections
		// to be initialized
		describe("when creating parent without collection data", function () {

			var order = new Order({ date: new Date(2012, 1, 1) });

			it("should create empty collection on model", function () {
				expect(order.get("lines") instanceof OrderLineCollection).toBeTruthy();
			});
		});

		describe("when creating parent without any data", function () {

			var order = new Order({});
			it("should create empty collection on model", function () {
				expect(order.get("lines") instanceof OrderLineCollection).toBeTruthy();
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

	describe("silent options", function () {

		var Order = Model.extend({
			attributeConversion: function () {
				return {
					customer: { model: Customer },
					lines: { collection: OrderLineCollection }
				};
			},
			correlationAttrs: ["date", "customer"]
		});
		var Customer = Model.extend({
			correlationAttrs: ["email"]
		});
		var OrderLine = Model.extend({
			attributeConversion: function () {
				return {
					product: { model: Product }
				};
			},
			correlationAttrs: ["product", "quantity"]
		});
		var Product = Backbone.Model.extend({
			correlationAttrs: ["ean"]
		});
		var OrderLineCollection = Backbone.Collection.extend({
			model: OrderLine,
			initialize: function (models, options) {
				this.parent = options.parent;
			}
		});

		var originalData = {
			id: 1233,
			customer: { id: 37373, name: "Tom", email: "tom@horseenthusiastmagazine.com" },
			date: new Date(2012, 1, 1),
			origin: "web",
			lines: [
				{ id: 13344, product: { id: 335, ean: "1234561234569", name: "Apple" }, quantity: 1 },
				{ id: 13345, product: { id: 335, ean: "3211561234569", name: "Pear" }, quantity: 2 }
			]
		};
		var newData = {
			id: 1233,
			customer: { id: 37373, name: "Tommy", email: "tommy@horseenthusiastmagazine.com" },
			date: new Date(2012, 1, 1),
			origin: "web",
			lines: [
				{ id: 13344, product: { id: 335, ean: "1234561234569", name: "Apple" }, quantity: 1 },
				{ id: 13345, product: { id: 335, ean: "3211561234569", name: "Pear" }, quantity: 2 }
			]
		};

		var order;
		beforeEach(function () {
			order = new Order(originalData);
		});

		it("should silently update nested model if silent specified", function () {
			var triggered = false;
			order.get('customer').on('change', function () { triggered = true; });
			order.set(newData, { silent: true });
			expect(triggered).toBeFalsy();
		});

		it("should update nested model normally if silent not specified", function () {
			var triggered = false;
			order.get('customer').on('change', function () { triggered = true; });
			order.set(newData);
			expect(triggered).toBeTruthy();
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

	describe("Backbone assumptions", function () {

		it("extending 2 different Models should have different prototypes", function () {
			var Model1 = Backbone.Model.extend({ something: 1 });
			var Model2 = Backbone.Model.extend({ something: 2 });
			var model1 = new Model1();
			var model2 = new Model2();
			expect(model1.constructor).not.toBe(model2.constructor);
			expect(model1.constructor.prototype).not.toBe(model2.constructor.prototype);
		});


	});


});
