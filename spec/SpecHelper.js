beforeEach(function () {
	this.addMatchers({
		toContainOnly: function (models) {
			var collection = this.actual;
			return collection.length === models.length && _.all(collection, function (model) {
				return _.include(models, model);
			});
		},
		toStartWith: function (other) {
			return this.actual.indexOf(other) === 0;
		},
		toBeInstanceOf: function (expected) {
			return this.actual instanceof expected;
		}
	});
});
