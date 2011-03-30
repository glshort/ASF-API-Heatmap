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
	// lat range: +/- 85.051130
	// lon range: +/- 180.000000
	var w = 360.0 / Math.pow(2, zoom);
	var h = 170.102260 / Math.pow(2, zoom);
	var west = tileCoord.x * w - 180.0;
	var east = (tileCoord.x + 1) * w - 180.0;
	var north = (Math.pow(2, zoom) - tileCoord.y) * h - 85.051130;
	var south = (Math.pow(2, zoom) - (tileCoord.y + 1)) * h - 85.051130;
	
	if(west > east) {
		var t = west;
		west = east;
		east = t;
	}
	
	return new google.maps.LatLngBounds(
		new google.maps.LatLng(south, west),
		new google.maps.LatLng(north, east));
}

function HeatMapType(tileSize) {
	this.tileSize = tileSize;
	this.projection = new MercatorProjection();
}

HeatMapType.prototype.getTile = function(coord, zoom, ownerDocument) {
	var div = ownerDocument.createElement('DIV');
	if(coord.y < 0 || coord.y >= Math.pow(2, zoom)) {
		return div;
	}
	var img = ownerDocument.createElement('IMG');
	img.src = "loading.gif";
	img.className = "loading";
	div.appendChild(img);
	div.className = 'tile loading';
	div.loading = true;
	div.id = "tilediv_" + coord.x.toString().replace("-", "_") + "_" + coord.y.toString().replace("-", "_") + "_" + zoom;
	var bbox = this.projection.getTileBounds(coord, zoom);
	$.ajax({
		context:			div,
		type:         "GET",
		url:          "http://testapi.daac.asf.alaska.edu/services/search/param",
		processData:  true,
		data:         {
										bbox: makeHappyAPIBoundsString(bbox),
										processing: 'BROWSE',
										format: 'count'
									},
		dataType:     "jsonp",
		success:			function(data, textStatus, jqXHR) {
										tileLoaded(this, data);
									}
	});
	return div;
};

function makeHappyAPIBoundsString(bbox) {
	var west = bbox.getSouthWest().lng();
	var south = bbox.getSouthWest().lat();
	var east = bbox.getNorthEast().lng();
	var north = bbox.getNorthEast().lat();
	if(west == 180 && east <= 0) {
		west = -180;
	}
	if(east == -180 && west >= 0) {
		east = 180;
	}
	return([west.toFixed(6), south.toFixed(6), east.toFixed(6), north.toFixed(6)].join(','));
}

function tileLoaded(div, data) {
	div.innerHTML = "";
	div.loading = false;
	var LUT = [2000000, 400000, 25000, 15000, 5000, 2000, 800, 400, 100];
	var scale;
	if(map.getZoom() >= LUT.length) {
		scale = LUT[LUT.length - 1];
	} else {
		scale = LUT[map.getZoom()];
	}
	var c = bound(data.count, 0, scale);
	if(div.className.match('active')) {
		div.className = 'tile active';
	} else {
		div.className = 'tile';
	}
	var r = Math.floor(255 * c / scale).toString(16);
	if(r.length == 1) {
		r = "0" + r;
	}
	var g = '00';
	var b = Math.floor(255-255 * c / scale).toString(16);
	if(b.length == 1) {
		b = "0" + b;
	}
	div.style.backgroundColor = "#" + r + g + b;
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
		"Cursor Location:",
		"<br />",
		latLng.toUrlValue(2),
		"<br />",
		"Region Bounds:",
		"<br />",
		"SW: ",
		tileBounds.getSouthWest().toUrlValue(3),
		"<br />",
		"NE: ",
		tileBounds.getNorthEast().toUrlValue(3)
		].join("");
	
	if(this.activeTile) {
		if(this.activeTile.loading) {
			this.activeTile.className = "tile loading";
		} else {
			this.activeTile.className = "tile";
		}
		this.activeTile = null;
	}
	var tilediv = document.getElementById("tilediv_" + tileCoord.x.toString().replace("-", "_") + "_" + tileCoord.y.toString().replace("-", "_") + "_" + map.getZoom());
	if(tilediv) {
		if(tilediv.loading) {
			tilediv.className = 'tile active loading';
		} else {
			tilediv.className = 'tile active';
		}
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
		zoom: 5,
		minZoom: 1,
		maxZoom: 8,
		center: new google.maps.LatLng(70, -145),
		mapTypeId: google.maps.MapTypeId.ROADMAP
	};
	map = new google.maps.Map(document.getElementById("heatmap"), mapOptions);
	
	var latLngControl = new LatLngControl(map);
	google.maps.event.addListener(map, 'mousemove', function(mEvent) {
		latLngControl.updatePosition(mEvent.latLng);});

	map.overlayMapTypes.insertAt(0, new HeatMapType(new google.maps.Size(tilesize,tilesize)));
}

google.maps.event.addDomListener(window, 'load', init);