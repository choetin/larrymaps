/* by choetin AT gmail DOT com (L)2012 
 * @filename: cookie-adapter.js
 * */

var larryCookie = Class.create({
	initialize: function(para){
        this.para = para;
		this.stageController = Mojo.Controller.stageController;
        this.ID = null;
        this.devInfo = {};
		this.appVersion = "";
		this.lastViewPoint = {};
		this.lastViewMapType = "";
		this.trackingUse = [];
		this.privateOffset = {};
		this.apiRefURL = "";
		this.searchHistory = [];
		this.extentUse = [];
		this.userEmail = "";
		this.speedUnit = "";
        this.LarryCookie = new Mojo.Model.Cookie("larryInfoCookie");
		this.LarryCookieObject = this.LarryCookie.get();
        if(! (this.LarryCookieObject && this.LarryCookieObject.ID)){
            Mojo.Log.error("##### larryCookie warn: just warn you, because of no correct cookie exists.");
			this.ID = (new Date()).getTime();
        	this.devInfo = {"model": Mojo.Environment.DeviceInfo.modelNameAscii, "winWidth": this.stageController.window.innerWidth, "winHeight": this.stageController.window.innerHeight};
			this.lastViewPoint = {"lat": 25.213604, "lon": 110.285375, "level": 16};
			this.lastViewMapType = "MAP";
			this.trackingUse.push(this.getDateTime());
			this.privateOffset = {enabled: true, "lat": 0.002805, "lon": 0.011621};
			this.apiRefURL = "http://api.map.baidu.com/api?v=1.3";
			this.appVersion = Mojo.appInfo.version;
			this.speedUnit = "mps"; // 米每秒 mps； 公里每小时 kmph
			this.LarryCookieObject = {
				"ID": this.ID,
				"appVersion": this.appVersion,
				"devInfo": this.devInfo,
				"launchLog": this.trackingUse,
				"lastViewPoint": this.lastViewPoint,
				"lastViewMapType": this.lastViewMapType,
				"privateOffset": this.privateOffset,
				"apiRefURL": this.apiRefURL,
				"userEmail": this.userEmail,
				"speedUnit": this.speedUnit
				};
			this.LarryCookie.put(this.LarryCookieObject);
        	} else {
				this.ID = this.LarryCookieObject.ID;
				this.appVersion = this.LarryCookieObject.appVersion;
				this.devInfo = this.LarryCookieObject.devInfo;
				this.trackingUse = this.LarryCookieObject.launchLog;
				this.lastViewPoint = this.LarryCookieObject.lastViewPoint;
				this.lastViewMapType = this.LarryCookieObject.lastViewMapType;
				this.privateOffset = this.LarryCookieObject.privateOffset;
				this.apiRefURL = this.LarryCookieObject.apiRefURL;
				this.userEmail = this.LarryCookieObject.userEmail;
				this.speedUnit = this.LarryCookieObject.speedUnit || "mps"; // 新增
				}
		},

	getDateTime: function(){
			var TS = new Date();
			var rVal =  {"Date": TS.getFullYear()+"/"+(TS.getMonth()+1)+"/"+TS.getDate(), "Time": TS.getHours()+":"+TS.getMinutes()+"."+TS.getSeconds()};
			delete TS;
			return rVal;
		},

	save: function(){
			if(! (""+this.LarryCookieObject.ID).match(/^\d{13}$/)){
					return false;
				}
			this.LarryCookieObject = {
				"ID": this.ID,
				"appVersion": this.LarryCookieObject.appVersion,
				"devInfo": this.LarryCookieObject.devInfo,
				"launchLog": this.trackingUse,
				"lastViewPoint": this.lastViewPoint,
				"lastViewMapType": this.lastViewMapType,
				"privateOffset": this.privateOffset,
				"apiRefURL": this.apiRefURL,
				"userEmail": this.userEmail,
				"speedUnit": this.speedUnit
				};
			///////////////////////
			//var JTS = new Converter();
			//var result = JTS.jsonToString(this.LarryCookieObject);
			//Mojo.Log.info("##### result: "+result);
			//////////////////////
			try{
				this.LarryCookie.put(this.LarryCookieObject);
				return true;
			}catch(e){
				Mojo.Log.error("##### larryCookie#save gets ERROR.");
				return false;
				}
		},

	appendSearchHistory: function(keyword){
			if(! keyword)
				return;
			if(this.searchHistory.length == 5){
					var tmp = [];
					for(var i=0; i<5-1; i++){
							tmp[i] = this.searchHistory[i+1];
						}
					this.searchHistory = tmp;
				}
			this.searchHistory.push({"keyword": keyword, "when": this.getDateTime()});
			return this.save();
		},

	updateTrackingUse: function(){
			if(this.trackingUse.length == 5){
					var tmp = [];
					for(var i=0; i<5-1; i++){
							tmp[i] = this.trackingUse[i+1];
						}
					this.trackingUse = tmp;
				}
			this.trackingUse.push(this.getDateTime());
			return this.save();
		},

	changeApiRefURL: function(url){
			if(! url)
				return;
			this.apiRefURL = url;
			return this.save();
		},

	savePrivateOffset: function(osObj){
			if(typeof(osObj) != "object" || ! (osObj.lat && osObj.lon))
				return;
			this.privateOffset = osObj;
			return this.save();
		},

	updateLastViewPoint: function(point){
			if(typeof(point) != "object" || ! (point.lat && point.lon && point.level))
				return;
			this.lastViewPoint = point;
			return this.save();
		},

	updateLastViewMapType: function(mapType){
			if(typeof(mapType) == "string" && (mapType.match(/^MAP$/) || mapType.match(/^SAT$/) || mapType.match(/^PER$/) || mapType.match(/^HYB$/))){
				this.lastViewMapType = mapType;
				return this.save();
			}
		},

	saveUserEmail: function(email){
			if(typeof(email) == "string" && email.match(/^[a-zA-Z0-9._]{1,}@[a-zA-Z0-9]{1,}.[a-zA-Z0-9]{1,}[.]*[a-zA-Z0-9]{1,}$/)){
					this.userEmail = email;
					return this.save();
				}
		},

	setSpeedUnit: function(unit){
			if(typeof(unit) == "string" && (unit == "mps" || unit == "kmph")){
					this.speedUnit = unit;
					return this.save();
				}
		}
});

/*
var Converter = Class.create({
    // Ref:heweiya @  http://heweiya.iteye.com/blog/442167
	// For test only!!!
	jsonToString: function(obj){
    var THIS = this;   
        switch(typeof(obj)){  
            case 'string':  
                return '"' + obj.replace(/(["\\])/g, '\\$1') + '"';  
            case 'array':  
                return '[' + obj.map(THIS.jsonToString).join(',') + ']';  
            case 'object':  
                 if(obj instanceof Array){  
                    var strArr = [];  
                    var len = obj.length;  
                    for(var i=0; i<len; i++){  
                        strArr.push(THIS.jsonToString(obj[i]));  
                    }  
                    return '[' + strArr.join(',') + ']';  
                }else if(obj==null){  
                    return 'null';  
  
                }else{  
                    var string = [];  
                    for (var property in obj) string.push(THIS.jsonToString(property) + ':' + THIS.jsonToString(obj[property]));  
                    return '{' + string.join(',') + '}';  
                }  
            case 'number':  
                return obj;  
            case false:  
                return obj;  
        }},
		stringToJSON: function(obj){  
		    return eval('(' + obj + ')');  
		}
    });
*/
