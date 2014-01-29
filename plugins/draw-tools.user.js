// ==UserScript==
// @id             iitc-plugin-draw-tools@breunigs
// @name           IITC plugin: draw tools
// @category       Layer
// @version        0.6.0.@@DATETIMEVERSION@@
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @updateURL      @@UPDATEURL@@
// @downloadURL    @@DOWNLOADURL@@
// @description    [@@BUILDNAME@@-@@BUILDDATE@@] Allow drawing things onto the current map so you may plan your next move.
// @include        https://www.ingress.com/intel*
// @include        http://www.ingress.com/intel*
// @match          https://www.ingress.com/intel*
// @match          http://www.ingress.com/intel*
// @grant          none
// ==/UserScript==

@@PLUGINSTART@@

// PLUGIN START ////////////////////////////////////////////////////////


// use own namespace for plugin
window.plugin.drawTools = function() {};

window.plugin.drawTools.loadExternals = function() {
  try { console.log('Loading leaflet.draw JS now'); } catch(e) {}
  @@INCLUDERAW:external/leaflet.draw.js@@
  try { console.log('done loading leaflet.draw JS'); } catch(e) {}

  window.plugin.drawTools.boot();

  $('head').append('<style>@@INCLUDESTRING:external/leaflet.draw.css@@</style>');
}

window.plugin.drawTools.setOptions = function(color) {
  if (color === undefined) color = '#a24ac3';

  window.plugin.drawTools.lineOptions = {
    stroke: true,
    color: color,
    weight: 4,
    opacity: 0.5,
    fill: false,
    clickable: true
  };

  window.plugin.drawTools.polygonOptions = L.extend({}, window.plugin.drawTools.lineOptions, {
    fill: true,
    fillColor: null, // to use the same as 'color' for fill
    fillOpacity: 0.2
  });

  window.plugin.drawTools.editOptions = L.extend({}, window.plugin.drawTools.polygonOptions, {
    dashArray: [10,10]
  });

  window.plugin.drawTools.markerOptions = {
    icon: new L.Icon.Default(),
    zIndexOffset: 2000
  };

}


// renders the draw control buttons in the top left corner
window.plugin.drawTools.addDrawControl = function() {
  var drawControl = new L.Control.Draw({
    draw: {
      rectangle: false,
      polygon: {
        title: 'Add a polygon\n\n'
          + 'Click on the button, then click on the map to\n'
          + 'define the start of the polygon. Continue clicking\n'
          + 'to draw the line you want. Click the first or last\n'
          + 'point of the line (a small white rectangle) to\n'
          + 'finish. Double clicking also works.',
        shapeOptions: window.plugin.drawTools.polygonOptions,
        snapPoint: window.plugin.drawTools.getSnapLatLng,
      },

      polyline: {
        title: 'Add a (poly) line.\n\n'
          + 'Click on the button, then click on the map to\n'
          + 'define the start of the line. Continue clicking\n'
          + 'to draw the line you want. Click the <b>last</b>\n'
          + 'point of the line (a small white rectangle) to\n'
          + 'finish. Double clicking also works.',
        shapeOptions: window.plugin.drawTools.lineOptions,
        snapPoint: window.plugin.drawTools.getSnapLatLng,
      },

      circle: {
        title: 'Add a circle.\n\n'
          + 'Click on the button, then click-AND-HOLD on the\n'
          + 'map where the circle’s center should be. Move\n'
          + 'the mouse to control the radius. Release the mouse\n'
          + 'to finish.',
        shapeOptions: window.plugin.drawTools.polygonOptions,
        snapPoint: window.plugin.drawTools.getSnapLatLng,
      },

      marker: {
        title: 'Add a marker.\n\n'
          + 'Click on the button, then click on the map where\n'
          + 'you want the marker to appear.',
        shapeOptions: window.plugin.drawTools.markerOptions,
        snapPoint: window.plugin.drawTools.getSnapLatLng,
        repeatMode: true,
      },

    },

    edit: {
      featureGroup: window.plugin.drawTools.drawnItems,

      edit: {
        title: 'Edit drawn items',
        selectedPathOptions: window.plugin.drawTools.editOptions,
      },

      remove: {
        title: 'Delete drawn items'
      },

    },

  });

  map.addControl(drawControl);
//  plugin.drawTools.addCustomButtons();
}


// given a point it tries to find the most suitable portal to
// snap to. It takes the CircleMarker’s radius and weight into account.
// Will return null if nothing to snap to or a LatLng instance.
window.plugin.drawTools.getSnapLatLng = function(unsnappedLatLng) {
  var containerPoint = map.latLngToContainerPoint(unsnappedLatLng);
  var candidates = [];
  $.each(window.portals, function(guid, portal) {
    var ll = portal.getLatLng();
    var pp = map.latLngToContainerPoint(ll);
    var size = portal.options.weight + portal.options.radius;
    var dist = pp.distanceTo(containerPoint);
    if(dist > size) return true;
    candidates.push([dist, ll]);
  });

  if(candidates.length === 0) return unsnappedLatLng;
  candidates = candidates.sort(function(a, b) { return a[0]-b[0]; });
  return candidates[0][1];
}


window.plugin.drawTools.save = function() {
  var data = [];

  window.plugin.drawTools.drawnItems.eachLayer( function(layer) {
    console.log(layer);
    var item = {};
    if (layer instanceof L.GeodesicCircle || layer instanceof L.Circle) {
      item.type = 'circle';
      item.latLng = layer.getLatLng();
      item.radius = layer.getRadius();
      item.color = layer.options.color;
    } else if (layer instanceof L.GeodesicPolygon || layer instanceof L.Polygon) {
      item.type = 'polygon';
      item.latLngs = layer.getLatLngs();
      item.color = layer.options.color;
    } else if (layer instanceof L.GeodesicPolyline || layer instanceof L.Polyline) {
      item.type = 'polyline';
      item.latLngs = layer.getLatLngs();
      item.color = layer.options.color;
    } else if (layer instanceof L.Marker) {
      item.type = 'marker';
      item.latLng = layer.getLatLng();
    } else {
      console.warn('Unknown layer type when saving draw tools layer');
      return; //.eachLayer 'continue'
    }

    data.push(item);
  });

  localStorage['plugin-draw-tools-layer'] = JSON.stringify(data);

  console.log('draw-tools: saved to localStorage');
}

window.plugin.drawTools.load = function() {
  var dataStr = localStorage['plugin-draw-tools-layer'];
  if (dataStr === undefined) return;

  var data = JSON.parse(dataStr);
  $.each(data, function(index,item) {
    var layer = null;
    switch(item.type) {
      case 'polyline':
        window.plugin.drawTools.setOptions(item.color);
        layer = L.geodesicPolyline(item.latLngs,window.plugin.drawTools.lineOptions);
        break;
      case 'polygon':
        window.plugin.drawTools.setOptions(item.color);
        layer = L.geodesicPolygon(item.latLngs,window.plugin.drawTools.polygonOptions);
        break;
      case 'circle':
        window.plugin.drawTools.setOptions(item.color);
        layer = L.geodesicCircle(item.latLng,item.radius,window.plugin.drawTools.polygonOptions);
        break;
      case 'marker':
        // TODO? marker colours
        layer = L.marker(item.latLng,window.plugin.drawTools.markerOptions)
        break;
      default:
        console.warn('unknown layer type "'+item.type+'" when loading draw tools layer');
        break;
    }
    if (layer) {
      window.plugin.drawTools.drawnItems.addLayer(layer);
    }

  });

}

//Draw Tools Options

// Manual import, export and reset data
window.plugin.drawTools.manualOpt = function() {
  dialog({
    html: plugin.drawTools.htmlSetbox,
    dialogClass: 'ui-dialog-drawtoolsSet',
    title: 'Draw Tools Options'
  });
}

window.plugin.drawTools.optAlert = function(message) {
    $('.ui-dialog-drawtoolsSet .ui-dialog-buttonset').prepend('<p class="drawtools-alert" style="float:left;margin-top:4px;">'+message+'</p>');
    $('.drawtools-alert').delay(2500).fadeOut();
}

window.plugin.drawTools.optCopy = function() {
    dialog({
      html: '<p><a onclick="$(\'.ui-dialog-drawtoolsSet-copy textarea\').select();">Select all</a> and press CTRL+C to copy it.</p><textarea readonly onclick="$(\'.ui-dialog-drawtoolsSet-copy textarea\').select();">'+localStorage['plugin-draw-tools-layer']+'</textarea>',
      width: 600,
      dialogClass: 'ui-dialog-drawtoolsSet-copy',
      title: 'Draw Tools Export'
    });
}

window.plugin.drawTools.optPaste = function() {
  var promptAction = prompt('Press CTRL+V to paste it.', '');
  if(promptAction !== null && promptAction !== '') {
    localStorage['plugin-draw-tools-layer'] = promptAction;
    window.plugin.drawTools.drawnItems.clearLayers();
    window.plugin.drawTools.load();
    console.log('DRAWTOOLS: reset and imported drawn tiems');
    window.plugin.drawTools.optAlert('Import Successful.');
  }
}

window.plugin.drawTools.optReset = function() {
  var promptAction = confirm('All drawn items will be deleted. Are you sure?', '');
  if(promptAction) {
    delete localStorage['plugin-draw-tools-layer'];
    window.plugin.drawTools.drawnItems.clearLayers();
    window.plugin.drawTools.load();
    console.log('DRAWTOOLS: reset all drawn items');
    window.plugin.drawTools.optAlert('Reset Successful. ');
  }
}
 
window.plugin.drawTools.optColor = function() {
  var promptAction = prompt('Current Color is '+window.plugin.drawTools.lineOptions.color, '');
  if(promptAction !== null && promptAction !== '') {
    window.plugin.drawTools.setOptions(promptAction);
    console.log('DRAWTOOLS: color changed');
    window.plugin.drawTools.optAlert('Color Changed. ');
  }
}

window.plugin.drawTools.boot = function() {
  window.plugin.drawTools.setOptions();

  //create a leaflet FeatureGroup to hold drawn items
  window.plugin.drawTools.drawnItems = new L.FeatureGroup();

  //load any previously saved items
  plugin.drawTools.load();

  //add the draw control - this references the above FeatureGroup for editing purposes
  plugin.drawTools.addDrawControl();

  //start off hidden. if the layer is enabled, the below addLayerGroup will add it, triggering a 'show'
  $('.leaflet-draw-section').hide();


  //hide the draw tools when the 'drawn items' layer is off, show it when on
  map.on('layeradd', function(obj) {
    if(obj.layer === window.plugin.drawTools.drawnItems) {
      $('.leaflet-draw-section').show();
    }
  });
  map.on('layerremove', function(obj) {
    if(obj.layer === window.plugin.drawTools.drawnItems) {
      $('.leaflet-draw-section').hide();
    }
  });

  //add the layer
  window.addLayerGroup('Drawn Items', window.plugin.drawTools.drawnItems, true);


  //place created items into the specific layer
  map.on('draw:created', function(e) {
    var type=e.layerType;
    var layer=e.layer;
    window.plugin.drawTools.drawnItems.addLayer(layer);
    window.plugin.drawTools.save();
  });

  map.on('draw:deleted', function(e) {
    window.plugin.drawTools.save();
  });

  map.on('draw:edited', function(e) {
    window.plugin.drawTools.save();
  });
  //add options menu
  $('#toolbox').append('<a onclick="window.plugin.drawTools.manualOpt();return false;">DrawTools Opt</a>');
  plugin.drawTools.htmlSetbox = '<div id="drawtoolsSetbox">'
                        +'<a onclick="window.plugin.drawTools.optColor();">Set Color</a>'
                        +'<a onclick="window.plugin.drawTools.optCopy();">Copy/Export Drawn Items</a>'
                        +'<a onclick="window.plugin.drawTools.optPaste();return false;">Paste/Import Drawn Items</a>'
                        +'<a onclick="window.plugin.drawTools.optReset();return false;">Reset Drawn Items</a>'
                        +'</div>';

  $('head').append('<style>' +
        '#drawtoolsSetbox a { display:block; color:#ffce00; border:1px solid #ffce00; padding:3px 0; margin:10px auto; width:80%; text-align:center; background:rgba(8,48,78,.9); }'+
        '.ui-dialog-drawtoolsSet-copy textarea { width:96%; height:250px; resize:vertical; }'+
        '</style>');

}


var setup =  window.plugin.drawTools.loadExternals;

// PLUGIN END //////////////////////////////////////////////////////////

@@PLUGINEND@@
