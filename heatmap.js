var tilesize = 256;

var MERCATOR_RANGE = 256;

function bound(value, opt_min, opt_max) {
	if (opt_min != null) value = Math.max(value, opt_min);
	if (opt_max != null) value = Math.min(value, opt_max);
	return value;
}
 
function degreesToRadians(deg) {
	return deg * (Math.PI / 180);
}
 
function radiansToDegrees(rad) {
	return rad / (Math.PI / 180);
}
 
function MercatorProjection() {
	this.pixelOrigin_ = new google.maps.Point(
			MERCATOR_RANGE / 2, MERCATOR_RANGE / 2);
	this.pixelsPerLonDegree_ = MERCATOR_RANGE / 360;
	this.pixelsPerLonRadian_ = MERCATOR_RANGE / (2 * Math.PI);
};

MercatorProjection.prototype.fromLatLngToPoint = function(latLng, opt_point) {
	var me = this;

	var point = opt_point || new google.maps.Point(0, 0);

	var origin = me.pixelOrigin_;
	point.x = origin.x + latLng.lng() * me.pixelsPerLonDegree_;
	// NOTE(appleton): Truncating to 0.9999 effectively limits latitude to
	// 89.189.  This is about a third of a tile past the edge of the world tile.
	var siny = bound(Math.sin(degreesToRadians(latLng.lat())), -0.9999, 0.9999);
	point.y = origin.y + 0.5 * Math.log((1 + siny) / (1 - siny)) * -me.pixelsPerLonRadian_;
	return point;
};
 
MercatorProjection.prototype.fromPointToLatLng = function(point) {
	var me = this;
	
	var origin = me.pixelOrigin_;
	var lng = (point.x - origin.x) / me.pixelsPerLonDegree_;
	var latRadians = (point.y - origin.y) / -me.pixelsPerLonRadian_;
	var lat = radiansToDegrees(2 * Math.atan(Math.exp(latRadians)) - Math.PI / 2);
	return new google.maps.LatLng(lat, lng);
};

MercatorProjection.prototype.getTileCoord = function(latLng) {
	var worldCoordinate = this.fromLatLngToPoint(latLng);
	var pixelCoordinate = new google.maps.Point(worldCoordinate.x * Math.pow(2, map.getZoom()), worldCoordinate.y * Math.pow(2, map.getZoom()));
	return(new google.maps.Point(Math.floor(pixelCoordinate.x / tilesize), Math.floor(pixelCoordinate.y / tilesize)));
}

MercatorProjection.prototype.getTileBounds = function(tileCoord, zoom) {
	var pleft = tileCoord.x * tilesize * Math.pow(2, zoom);
	var pright = (tileCoord.x + 1) * tilesize * Math.pow(2, zoom);
	var ptop = tileCoord.y * tilesize * Math.pow(2, zoom);
	var pbottom = (tileCoord.y + 1) * tilesize * Math.pow(2, zoom);
	
	var sw = this.fromPointToLatLng(new google.maps.Point(pleft, pbottom));
	var ne = this.fromPointToLatLng(new google.maps.Point(pright, ptop));
	
	return new google.maps.LatLngBounds(sw, ne);
}

function HeatMapType(tileSize) {
	this.tileSize = tileSize;
	this.projection = new MercatorProjection();
}

HeatMapType.prototype.getTile = function(coord, zoom, ownerDocument) {
	var div = ownerDocument.createElement('DIV');
	if(coord.y < 0 || coord.y >= Math.pow(2, zoom)) { return div; }
	div.className = 'tile';
	div.style.opacity = 0.0;
	div.id = "tilediv_" + coord.x.toString().replace("-", "_") + "_" + coord.y.toString().replace("-", "_") + "_" + zoom;
	var bbox = this.projection.getTileBounds(coord, zoom);
	div.innerHTML = coord.toString() + ", " + zoom + "<br />" + bbox.toString();
	
	$.ajax({
		type:         "GET",
		url:          "http://api.daac.asf.alaska.edu/services/search/param",
		processData:  true,
		data:         {
										bbox: '-126,69.75,-125.75,70',
										processing: 'L1',
										format: 'count'
									},
		dataType:     "jsonp",
		dataFilter:		function(data, type) {
										console.log('filtering: ' + JSON.stringify(data));
										return({count: parseInt(JSON.stringify(data))});
									},
		success:      new Function(
										"tileloaded_" + coord.x.toString().replace("-", "_") + "_" + coord.y.toString().replace("-", "_") + "_" + zoom,
										"data", "textStatus", "jqXHR",
										"console.log('success: ' + data); tileloaded(" + coord.x + ", " + coord.y + ", " + zoom + ", data);"),
	});
	return div;
};

function tileloaded(x, y, z, data) {
	var scale = 10;//Math.floor(Math.pow(2, (29-z) * 0.5));
	var tilediv = document.getElementById("tilediv_" + x.toString().replace("-", "_") + "_" + y.toString().replace("-", "_") + "_" + z);
	var c = data;
	tilediv.innerHTML = "(" + x + ", " + y + ")<br />" + c + "/" + scale;
	if(c < 0) {
		c = 0;
	} else if(c > scale) {
		c = scale;
	}
	tilediv.className = 'tile';
	tilediv.style.opacity = (c / scale) * 0.5;
	tilediv.style.backgroundColor = "#" + (Math.floor(255 * c / scale)).toString(16) + "00" + (Math.floor(255-255 * c / scale)).toString(16);
}

function LatLngControl(map) {
	this.node_ = this.createHtmlNode_();
	map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(this.node_);
	this.setMap(map);
	this.set('visible', true);
	this.activeTile = null;
	this.projection = new MercatorProjection();
}

LatLngControl.prototype = new google.maps.OverlayView();
LatLngControl.prototype.draw = function() {};

LatLngControl.prototype.createHtmlNode_ = function() {
	var divNode = document.createElement('div');
	divNode.id = 'latlng-control';
	divNode.index = 100;
	divNode.className = 'infopane';
	return divNode;
};

LatLngControl.prototype.visible_changed = function() {
	this.node_.style.display = this.get('visible') ? '' : 'none';
};

LatLngControl.prototype.updatePosition = function(latLng) {
	var tileCoord = this.projection.getTileCoord(latLng);
	var tileBounds = this.projection.getTileBounds(tileCoord, map.getZoom());
	var worldCoordinate = this.projection.fromLatLngToPoint(latLng);
	this.node_.innerHTML = [
		latLng.toUrlValue(4),
		"<br />",
		"Tile: ",
		this.projection.getTileCoord(latLng).toString(),
		", ",
		map.getZoom(),
		"<br />",
		"World: (",
		Math.floor(worldCoordinate.x),
		",",
		Math.floor(worldCoordinate.y),
		")<br />",
		"Pixel: ",
		new google.maps.Point(Math.floor(worldCoordinate.x * Math.pow(2, map.getZoom())), Math.floor(worldCoordinate.y * Math.pow(2, map.getZoom()))).toString(),
		"<br />",
		"NE: ",
		tileBounds.getNorthEast().toUrlValue(3),
		"<br />",
		"SW: ",
		tileBounds.getSouthWest().toUrlValue(3)
		].join("");
	
	if(this.activeTile) {
		this.activeTile.className = "tile";
		this.activeTile = null;
	}
	var tilediv = document.getElementById("tilediv_" + tileCoord.x.toString().replace("-", "_") + "_" + tileCoord.y.toString().replace("-", "_") + "_" + map.getZoom());
	if(tilediv) {
		tilediv.className = 'tile active';
		this.activeTile = tilediv;
	}
};

var map;

function init() {
	var sWidth;
	var sHeight;
	if (window.innerWidth) {
		sWidth = window.innerWidth;
		sHeight = window.innerHeight;
	} else if(document.all) {
		sWidth = document.body.clientWidth;
		sHeight = document.body.clienHeight;
	}
	document.getElementById("heatmap").style.width = sWidth + "px";
	document.getElementById("heatmap").style.height = sHeight + "px";
	var mapOptions = {
		zoom: 0,
		center: new google.maps.LatLng(64.85,-147.85),
		mapTypeId: google.maps.MapTypeId.ROADMAP
	};
	map = new google.maps.Map(document.getElementById("heatmap"), mapOptions);
	
	var latLngControl = new LatLngControl(map);
	google.maps.event.addListener(map, 'mousemove', function(mEvent) {
		latLngControl.updatePosition(mEvent.latLng);});

	map.overlayMapTypes.insertAt(0, new HeatMapType(new google.maps.Size(tilesize,tilesize)));
}

google.maps.event.addDomListener(window, 'load', init);

console.log("--------------------");