Some extensions to make working with Backbone.js even easier.

Early days, nothing to see here yet!

Features:

IMPORTANT: This currently requires a patch to backbone.js (new Model.prepareValue method and call to prepareValue in Model.set method). I'm trying to see if there is a better way to intercept attribute value creation to support what we're trying to do. If there isn't, I'll request the addition of a prepareValue hook to Backbone.

Attribute Conversion - Makes it easier to work with a complex object graph containing child models and collections