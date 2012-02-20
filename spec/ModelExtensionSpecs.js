describe("ModelExtensionSpecs", function () {

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
				model: OrderLine
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


	});
});