# Backbone.easyext

## Intro

Some extensions to make working with Backbone.js even easier.

Early days, nothing to see here yet!

## Features:

### Attribute Conversion

Makes it easier to work with a complex object graph containing child models and collections. It ensures that JSON objects are automatically converted to the correct model / collection types during creation / modification and sync of your models.

IMPORTANT: This currently requires a patch to backbone.js (new Model.prepareValue method and call to prepareValue in Model.set method). I'm trying to see if there is a better way to intercept attribute value creation to support what we're trying to do. If there isn't, I'll request the addition of a prepareValue hook to Backbone.

### Dirty Tracking 

A simple way to track modifications to your models