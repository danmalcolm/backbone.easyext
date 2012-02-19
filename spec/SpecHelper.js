beforeEach(function () {
	this.addMatchers({
		toContainOnly: function (models) {
			var collection = this.actual;
			return collection.length === models.length && _.all(collection, function (model) {
				return _.include(models, model);
			});
		}
	});
});
