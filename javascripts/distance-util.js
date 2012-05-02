/* by choetin AT gmail DOT com (L)2012 
 * @filename: distance-util.js
 * */

function distanceUtil(map, callback){
	if(typeof(BMap) == undefined)
		return null;
	if(! map instanceof BMap.Map)
		return null;
	this.map = map;
	this.callback = callback || function(){};
	this.polyLine = undefined;
	this.route = {"points": [], "markers": []};
	this.icon = new BMap.Icon(
			"images/tine-red.png",
			new BMap.Size(25, 32),
			{
				anchor: new BMap.Size(4, 32),
				infoWindowAnchor: new BMap.Size(13, 0)
			}
		);
};

distanceUtil.prototype = {
	addPoint: function(poi){
		if(! poi instanceof BMap.Point)
			return null;
		var poiCount = this.getLength();
		this.route.points[poiCount] = poi;
		this.addMarker(poiCount);
		if(this.polyLine)
			this.map.removeOverlay(this.polyLine);
		this.refreshMarkersOnMap();
		return poi;
	},

	deletePoint: function(arg){
		if(! (arg instanceof BMap.Point || typeof(arg) == "number"))
			return null;
		var poiCount = this.getLength();
		if(this.polyLine)
			this.map.removeOverlay(this.polyLine);
		if(poiCount == 0)
			return 0;
		if(arg instanceof BMap.Point){
			for(var i=0; i<poiCount, this.route.points[i]; i++){
				if(arg.equals(this.route.points[i])){
					this.removeMarker(i);
					for(var j=i; j<poiCount - 1; j++){
						this.route.points[j] = new BMap.Point(this.route.points[j + 1].lng, this.route.points[j + 1].lat);
					}
					this.route.points.splice(j, 1);
				}
			}
		}
		if(typeof(arg) == "number"){
			for(var i=0; i<poiCount, this.route.points[i]; i++){
				if(arg == i){
					this.removeMarker(i);
					for(var j=i; j<poiCount - 1; j++){
						this.route.points[j] = new BMap.Point(this.route.points[j + 1].lng, this.route.points[j + 1].lat);
					}
					this.route.points.splice(j, 1);
				}
			}
		}
		this.refreshMarkersOnMap();
		return poiCount;
	},

	cancelMeasuring: function(){
		var poiCount = this.getLength();
		if(this.polyLine){
			this.map.removeOverlay(this.polyLine);
		}
		for(var i=poiCount-1; i>=0; i--){
			this.removeMarker(i);
			this.route.points.splice(i, 1);
		}
	},

	getLength: function(){
		return this.route.points.length;
	},
	
	/*
	 *	@private method
	 */
	refreshMarkersOnMap: function(){
		var poiCount = this.getLength();
		if(poiCount == 0)
			return;
		if(poiCount > 0)
			this.polyLine = new BMap.Polyline(
					this.route.points, 
					{
						strokeColor: "#66ee66",
						strokeWeight: 3,
						strokeOpacity: 0.7,
						strokeStyle: "dashed"
					}
				);
		var distance = 0;
		if(this.polyLine)
			this.map.addOverlay(this.polyLine);
		for(var i=0; i<poiCount; i++){
			this.addMarker(i);
			if(i + 1 != poiCount)
				distance += this.map.getDistance(this.route.points[i], this.route.points[i + 1]);
		}
		this.callback(distance.toFixed(2));
	},
	
	/*
	 *	@private method
	 */
	removeMarker: function(index){
		if(this.route.markers[index] instanceof BMap.Marker){
			this.map.removeOverlay(this.route.markers[index]);
			this.route.markers.splice(index, 1);
		}
	},
	
	/*
	 *	@private method
	 */
	addMarker: function(index){
		if(this.route.markers[index] instanceof BMap.Marker)
			this.map.removeOverlay(this.route.markers[index]);
		this.route.markers[index] = new BMap.Marker(
				this.route.points[index],
				{
					icon: this.icon
				}
			);
		this.map.addOverlay(this.route.markers[index]);
	}
};
