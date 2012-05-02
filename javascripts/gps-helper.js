/* by choetin AT gmail DOT com (L)2012 
 * @filename: gps-helper.js
 * */

var GPS = Class.create({
	initialize: function(LM){
		this.T = LM;
		this.serviceHandler = undefined;
		// GAFC - the initial gps lat/lon.
		this.LAT = 25.213604;
		this.LON = 110.285375;
		this.ALT = 0;
		this.oldLAT = undefined;
		this.oldLon = undefined;
		this.oldALT = undefined;
		
		// Done by larryCookie now!!!!
		//
		// Due to the f^cking "National Administration of Surveying, Mapping and
		// Geoinformation OF CHINA",
		// I simply add these offsets to locate our true location.
		// choetin AT gmail DOT com
		//this.offset_lon = 0.011621;
		//this.offset_lat = 0.002805;
	
		// is Gps Ready? - default to false
		this.isGpsReady = false;
		this.errorText = "";
		this.oldErrorText = "";
	},
	
	get: function(){
		return {	"isGpsReady": this.isGpsReady,
					"gps": {
						"lat": this.LAT, 
						"lon": this.LON, 
						"errorText": this.errorText
						},
					"old": {
						"lat": this.oldLAT,
						"lon": this.oldLON,
						"errorText": this.oldErrorText
						}
				};
	},
	
	track : function() {
		if(! this.serviceHandler){
			this.serviceHandler = this.T.controller.serviceRequest(
				'palm://com.palm.location', {
					method : 'startTracking',
					parameters : {
						accuracy : 1,
						maximumAge : 1,
						responseTime : 1,
						subscribe : true
						},
					onSuccess : this.handleGpsResponse.bind(this),
					onFailure : this.getGpsErrorText.bind(this)
				}
			);
		}
	},

	stop: function(){
			try{
				this.serviceHandler.cancel();
				delete this.serviceHandler;
				//this.isGpsReady = false;
			}catch(e){
				Mojo.Log.error("##### GPS#serviceHandler error: may cancel a non-exist service.");
				}
		},
	
	handleGpsResponse : function(event) {
		if (!(isNaN(event.latitude) || isNaN(event.longitude))){
			this.oldLAT = this.LAT;
			this.oldLON = this.LON;
			// this.oldALT = this.ALT;
			this.LAT = event.latitude; // + this.offset_lat;
			this.LON = event.longitude; // + this.offset_lon;
			//this.ALT = event.alitude;
			this.isGpsReady = true;
		}else{
			this.isGpsReady = false;
		}
	},
	
	getGpsErrorText : function(event) {
		this.oldErrorText = this.errorText;
		this.errorText =  this._getMessageForGpsErrorCode(event.errorCode);
	},
	
	// resolv the GPS error code
	_getMessageForGpsErrorCode : function(code) {
		switch (code) {
		case 0: return $L("定位成功, 真是太恭喜你了! ;-)");
		case 1: return $L("GPS超时, 请检查检查是什么原因! :-(");
		case 2: return $L("GPS定位不可用, 请到在室外或者天气晴朗时再尝试! :-(");
		case 4: return $L("仅机站定位及WIFI定位可用,GPS可能未启用! :-(");
		case 5: return $L("定位服务已经关闭啦, 要使用定位功能,请打开定位服务! :-(");
		case 6: return $L("你没有权限使用GPS哦, 请检查检查是什么原因! :-(");
		case 7: return $L("你也许需要把'定位服务'设置为'自动定位'再打开本程序  ;-)");
		case 8: return $L("你可能已经禁止本程序使用GPS! 因此不能持续定位你的位置!请作正确设置再使用定位功能!! :-(");
		case 3:
		default: return $L("未知原因 (#{code})").interpolate({ code : code });
		}
	}
});
