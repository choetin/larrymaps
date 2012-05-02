/* by choetin AT gmail DOT com (L)2012 
 * @filename: larrymaps-assistant.js
 * */

var ME = undefined;
var debug  = true;
var ERROR = function(param){
		if(debug && param)
			Mojo.Log.error(param);
	};

var LarrymapsAssistant = Class.create({
	initialize: function(params){
			ME = this;
			this.larryCookie = new larryCookie();
			this.networkAvailable = false;
			this.apiInfoDATA = undefined; // API的COOKIE实例
			this.apiLoaded = false; // API是否已经加载
			this.mapReady = false; // 地图是否已经就绪
			this.searchBarFocused = false; // 搜索条是否处于焦点
			this.params = params;
			this.mapLat = undefined; // 全局坐标纬度
			this.mapLon = undefined; // 全局坐标经度
			this.mapZoomLevel = undefined; // 全局坐标放大 级别 
			this.minZoom = 15; // 地图最小级别
			this.maxZoom = 18; // 地图最大级别
			this.speed = 0; // 当前 GPS速度
			this.showBoxPending = false; // 禁止新BOX出现
			this.inDrag = false; // 处于拖动状态
			this.inGesture = false; // 处于绽放状态
			this.gblDraggingEventXY = undefined; // 用于保存拖动的起始坐标的临时变量
			this.panelShowed = false;
			this.boxShowed = false;
			this.spinnerShowed = false;
		},

	setup: function(event){
		this.setupSizeStuff();
		this.menuAttr = {omitDefaultItems: true};
		this.menuModel = {
			visible: true,
			items: [
				Mojo.Menu.editItem,
				{label: "设置",command: "go-pref", shortcut: "s"},
				{label: "帮助",command: "go-help", shortcut: "h"}
			]
		};
		this.controller.setupWidget(Mojo.Menu.appMenu, this.menuAttr, this.menuModel);
		
		this.controller.setupWidget(
			"goNoNetworkHelp",
			{type: Mojo.Widget.activityButton},
			{label: "查看如何打开数据连接", buttonClass: 'affirmative', disabled: false}
 		);
 		Mojo.Event.listen(
 			this.controller.get('goNoNetworkHelp'),
 			Mojo.Event.tap,
 			function(){
				var R = new Mojo.Service.Request(
					'palm://com.palm.applicationManager',
					{
						method: 'launch',
						parameters: {id: 'com.palm.app.help', params: {target: 'no-network'}},
						onSuccess: function(){},
						onFailure: function(){ERROR("@@@@@ something goes wrong...")}
					}
				);
 			}
 		);
 		
 		this.controller.setupWidget(
			'searchBar', {
			hintText : "搜索/捷径...",
			modelProperty : 'value',
			inputName : 'searchElement',
			focus : false,
			autoFocus : false,
			multiline : false,
			enterSubmits : true,
			requiresEnterKey: true,
			changeOnKeyPress : true,
			textReplacement: false,
			focusMode : Mojo.Widget.focusSelectMode
			},
			{ value : this.searchText}
		);
		Mojo.Event.listen(
			this.controller.get("searchBar"),
			Mojo.Event.tap,
			this.handleSearchBarTap.bind(this)
		);
		Mojo.Event.listen(
			this.controller.get("searchBar"),
			Mojo.Event.propertyChange,
			this.handleSearchBarPropertyChange.bindAsEventListener(this)
		);
 		
 		this.controller.setupWidget(
			"bttnOK",
			{type: Mojo.Widget.activityButton},
			{label: "确定", buttonClass: 'affirmative'}
 		);
 		this.controller.setupWidget(
			"bttnCancel",
			{type: Mojo.Widget.activityButton},
			{label: "取消", buttonClass: 'negative'}
 		);
 		this.controller.setupWidget(
			"bttnCustom",
			{type: Mojo.Widget.activityButton},
			{label: "忽略", buttonClass: 'dismiss'}
 		);
 		
 		// 设置底部菜单
		this.cmdMenuAttr = {
			spacerHeight: 0,
		    menuClass: 'no-fade'
			};
		this.cmdMenuModel = {
			items:[ 
				{iconPath : "images/GPS-off.png" , command : 'toggleGPS'},
				{label : "Menu", command : 'showSubmenu' }
			]};
		this.controller.setupWidget(Mojo.Menu.commandMenu, this.cmdMenuAttr, this.cmdMenuModel);
		
		// 设置等待转钮
		this.controller.setupWidget(
			"updaterSpinner",
			{
				spinnerSize: "large",
				fps: 30
			},
			this.spinnerModel = {
					spinning: true
				}
			);
	},
	
	activate: function(event){	
		// 用于检查API状态
		if(this.apiInfoCookie)
			delete this.apiInfoCookie;
		this.apiInfoCookie = new Mojo.Model.Cookie("apiInfoCookie");
		this.apiInfoDATA = this.apiInfoCookie.get();
		
		if(this.larryCookie)
			delete this.larryCookie;
		this.larryCookie = new larryCookie();
		// 启动时间日志
		// this.larryCookie.updateTrackingUse();

		if (! this.networkAvailable){
			this.checkNetwork(this);
		} else {
			this.prepareMapAPI(this);
		}
		Mojo.Event.listen(this.controller.document, "keyup", this.handleDocumentKeyUp.bind(this));

		this.controller.listen(
			this.controller.get("rcontent"),
			Mojo.Event.tap,
			this.handleRcontentTap.bind(this)
			);

		this.controller.listen(
			this.controller.get("searchBarGoIcon"),
			Mojo.Event.tap,
			this.startToSearch.bind(this)
			);

		Mojo.Event.listen(
			this.controller.get("updaterSpinner"),
			Mojo.Event.hold,
			this.forceHideSpinner.bindAsEventListener(this)
		);
		
		// 抓取搜索框内的文本输入框事件
		ME.captureInsideEleEvt();
	},

	listenGestureEvents: function(){
		this.controller.listen(
				this.controller.document,
				"gesturestart",
				this.handleGestureStart.bindAsEventListener(this)
			);
		this.controller.listen(
				this.controller.document,
				"gestureend",
				this.handleGestureEnd.bindAsEventListener(this)
		);
		this.controller.listen(
				this.controller.document,
				"gesturechange",
				this.handleGestureChange.bind(this)
			);
		},

	stopListeningGestureEvents: function(){
		this.controller.stopListening(
				this.controller.document,
				"gesturestart",
				this.handleGestureStart.bindAsEventListener(this)
			);
		this.controller.stopListening(
				this.controller.document,
				"gestureend",
				this.handleGestureEnd.bindAsEventListener(this)
			);
		},

	listenDragEvents: function(){
		this.controller.listen(
				this.controller.get("map"),
				Mojo.Event.dragStart,
				this.handleDragStart.bindAsEventListener(this)
			);
		this.controller.listen(
				this.controller.get("map"),
				Mojo.Event.dragEnd,
				this.handleDragEnd.bindAsEventListener(this)
			);
		this.controller.listen(
				ME.controller.get("map"),
				Mojo.Event.dragging,
				ME.handleDragChange.bind(this)
			);
		},

	stopListeningDragEvents: function(){
		this.controller.stopListening(
				this.controller.get("map"),
				Mojo.Event.dragStart,
				this.handleDragStart.bindAsEventListener(this)
			);
		this.controller.stopListening(
				this.controller.get("map"),
				Mojo.Event.dragEnd,
				this.handleDragEnd.bindAsEventListener(this)
			);
		},
	
	deactivate: function(event){
			Mojo.Log.info("@@@@@ larrymaps#deactivate.");
			if(this.larryCookie)
				delete this.larryCookie;
			this.stopListeningDragEvents();
			this.stopListeningGestureEvents();
		},
	
	cleanup: function(event){
			Mojo.Log.info("@@@@@ larrymaps#cleanup.");
			if(this.map)
				delete this.map;
			if(this.trackMeTimer)
				this.stopTracking();

			this.controller.stopListening(this.controller.get('goNoNetworkHelp'), Mojo.Event.tap, function(){});
			this.controller.stopListening(this.controller.get("searchBar"), Mojo.Event.tap, this.handleSearchBarTap.bind(this));
			this.controller.stopListening(this.controller.get("map"), Mojo.Event.tap, this.handleMapTap.bind(this));
			this.controller.stopListening(this.controller.get("searchBar"), Mojo.Event.propertyChange, this.handleSearchBarPropertyChange.bind(this));
			this.controller.stopListening(this.controller.document, "keyup", this.handleDocumentKeyUp.bind(this));
			this.controller.stopListening(this.controller.get("rcontent"),Mojo.Event.tap,this.handleRcontentTap.bind(this))

			this.controller.stopListening(this.controller.get("searchBarGoIcon"), Mojo.Event.tap, this.startToSearch.bind(this));
			this.controller.stopListening(this.controller.get("map"), Mojo.Event.hold, this.handleMapHold.bind(this));
			this.removeInsideEleEvtObsering();
		},

	captureInsideEleEvt: function(){
			var searchBar = this.controller.get("searchBar");
			if(searchBar){
					var insideEle = searchBar.querySelector('[name = searchElement]');
					if(insideEle){
							insideEle.observe("focus", this.focusSearchBar.bind(this));
							insideEle.observe("blur", this.blurSearchBar.bind(this));
						}
				}
		},

	removeInsideEleEvtObsering: function(){
			var searchBar = this.controller.get("searchBar");
			if(searchBar){
					var insideEle = searchBar.querySelector('[name = searchElement]');
					if(insideEle){
							insideEle.stopObserving("focus", this.focusSearchBar.bind(this));
							insideEle.stopObserving("blur", this.blurSearchBar.bind(this));
						}
				}
		},
	
	setupSizeStuff: function(){
			// 设置一些尺寸，以适应不同设备屏幕
			var g = ME.controller.get;
			if(! ME.larryCookie)
				ME.larryCookie = new larryCookie();
			ME.h = parseInt(ME.larryCookie.devInfo.winHeight);
			ME.w = parseInt(ME.larryCookie.devInfo.winWidth);
			this.controller.document.body.height = ME.h;
			this.controller.document.body.width = ME.w;
			g("larryContainer").style.height = ME.h + "px";
			g("larryContainer").style.width = ME.w + "px"
			g("map").style.height =  (2 * ME.h) + "px";
			g("map").style.width = (2 * ME.w) + "px";
			g("map").style.top =  (0 - (ME.h/2)) + "px";
			g("map").style.left = (0 - (ME.w/2)) + "px";
			g("larry").style.maxHeight = (ME.h - 124) + "px";
			var styleSpinnerMask = "height:" + ME.h + "px;width:" + ME.w + "px;";
			g("larrymask").setStyle(styleSpinnerMask);
		},

	setupSearchStuff: function(){
		//////////////////////////////////////////////////////////
		// only for test, by now
		//////////////////////////////////////////////////////////
		//
		//
		//
			var refreshOurCuteVar = function(poi, html){
					var cookie = new larryCookie();
					ME.mapLat = (parseFloat(poi.point.lat) - parseFloat(cookie.privateOffset.lat)).toFixed(6);
					ME.mapLon = (parseFloat(poi.point.lng) - parseFloat(cookie.privateOffset.lon)).toFixed(6);
					ME.mapZoomLevel = ME.map.getZoom();
					ME.updateTopRightBox();
					ME.mapInfoWindow = ME.map.getInfoWindow();
					delete cookie;
				};
			
			// Define an instance of TransitRoute.
			// there are 5 records per page.
			var ff = function(rslt){
					ME.handleTransitRouteComplete(rslt);
					//ERROR("@@@@@ transitRoute ready:" + rslt);
				};
			ME.transitRoute = new BMap.TransitRoute(ME.map, {  
				renderOptions: {
					map: ME.map,
					autoViewport: true,
					selectFirstResult: true,
					panel: "panelContent"
				},
				pageCapacity: 5,
				onSearchComplete: ff,
				onInfoHtmlSet: refreshOurCuteVar
			});

			// Define an instance of localSearch.
			// there are 6 records per page.
			var f = function(rslt){
					ME.handleLocalSearchComplete(rslt);
					//ERROR("@@@@@ localSearch ready:" + rslt);
				};
			ME.localSearch = new BMap.LocalSearch(
				ME.map, {
					renderOptions : {
						map: ME.map,
						autoViewport: true,
						selectFirstResult: true,
						panel: "panelContent"
					},
				pageCapacity: 6,
				onSearchComplete: f,
				onInfoHtmlSet: refreshOurCuteVar
				});

			ME.geocoder = new BMap.Geocoder();

			ME.searchOnce = false;
		//
		//
		//
		//
		/////////////////////////////////////////////////////////
		},

	startToSearch: function(){
		// TODO: 打算做一个全能的搜索框
		try{
		if(! ME.mapReady){
				ME.showBox("地图还没准备好...", "请稍后再试");
				ME.closeBox();
				return;
			}
		ME.blurSearchBar();
		var keyword = ME.controller.get("searchBar").mojo.getValue();
		keyword = keyword.trim();
		ERROR("@@@@@ keyword: [" + keyword + "]");
		if(keyword == "" || keyword.indexOf("\.") == 0 || keyword.indexOf("Go") == 0)
			return;
		ME.startSpinner();
		ME.stopTracking();
		var kw = keyword;
		if(keyword.indexOf(",") != -1 && keyword.split(",")[1] != undefined){
				if(! ME.transitRoute)
					return;
				keyword = keyword.split(",");
				if(ME.searchOnce)
					ME.transitRoute.clearResults();
				ME.transitRoute.search(keyword[0], keyword[1]);
				ME.searchOnce = true;
				return;
			}
		if(kw.indexOf(",") == -1 || kw.split(",")[1] == undefined){
				if(! ME.localSearch)
					return;
				if(ME.searchOnce)
					ME.localSearch.clearResults();
				ME.localSearch.search(kw);
				ME.searchOnce = true;
				return;
			}
		}catch(e){
				ME.showBox("貌似出错了,极有可能是<font color='red'>网络不稳定</font>.<br>实在抱歉..<br>:-(", "请再试一次");
				ME.closeBox(3000);
				ME.stopSpinner();
				ERROR("@@@@ larrymaps#startToSearch Error: " + e);
			}
		},

	getLocationFromPoint: function(point, callbackFunc){
			ME.startSpinner();
			if(callbackFunc)
				var f = callbackFunc;
			else
				var f = function(v){
						if(v){
								var address;
								address = v.addressComponents.province + v.addressComponents.city + v.addressComponents.district + v.addressComponents.street + v.addressComponents.streetNumber;
								ME.stopSpinner();
								ME.closeBox();
								ME.controller.get("searchBar").mojo.setText(address);
							}
					};
			ME.geocoder.getLocation(
				point,
				f,
				{poiRadius: 300}
				);
		},

	// TODO: 好好处理结果,更好呈现结果
	handleLocalSearchComplete: function(result){
			// result structure:
			// {
			//	keyword: String,
			//	center: {	// LocalResultPoi
			//			title: String,
			//			point: Point // {lat: number, lng: number},
			//			url: String,
			//			address: String,
			//			city: String,
			//			phoneNumber: String,
			//			postcode: String,
			//			type: {
			//					enum: {BMAP_POI_TYPE_NORMAL, BMAP_POI_TYPE_BUSSTOP, BMAP_POI_TYPE_SUBSTOP}
			//				},
			//			isAccurate: boolean,
			//			province: String,
			//			tags: Array<String>
			//		},
			//	radius: number,
			//	bounds: {sw: Point, ne: Point},
			//	city: String,
			//	moreResultsUrl: String,
			//	province: String,
			//	suggestions: Array<String> // sugguest keyword[s] for no result.
			// }
			//
			// result methods:
			// 	getPoi(i:number[index]) = LocalResultPoi
			// 	getCurrentNumPois() = number // default page result counts.
			//	getNumPois() = number // total result counts.
			//	getNumPages() = number // total pages.
			//	getPageIndex() = number
			//	getCityList() = Array<{city: String, numResults: number}>
			ME.stopSpinner();
			ME.showHidePanel();
			ERROR("@@@@@search result:" + result);
		},

	// TODO: 好好处理结果,更好呈现结果
	handleTransitRouteComplete: function(result){
			// result structure:
			// 	{
			//		policy:{
			//				BMAP_TRANSIT_POLICY_LEAST_TIME |
			//				BMAP_TRANSIT_POLICY_LEAST_TRANSFER |
			//				BMAP_TRANSIT_POLICY_LEAST_WALKING |
			//				BMAP_TRANSIT_POLICY_AVOID_SUBWAYS
			//			},
			//		city: String,
			//		moreResultsUrl: String
			// 	}
			//
			// result methods:
			// 	getStart() = LocalResultPoi
			// 	getEnd() = LocalResultPoi
			// 	getNumPlans() = number // the counts of plans
			// 	getPlan(i:Number) = TransitRoutePlan/ methods:
			// 										/	getNumLines() = number
			// 										/	getLine(i:Number) = Line :  / structure:
			// 																		/	{
			// 																		/		title: String,
			// 																		/		type: enum-LineType: {
			// 																		/			BMAP_LINE_TYPE_BUS |
			// 																		/			BMAP_LINE_TYPE_SUBWAY |
			// 																		/			BMAP_LINE_TYPE_FERRY
			// 																		/			}
			// 																		/	}
			// 																		/ methods:
			// 																		/	getNumViaStops() = number
			// 																		/	getGetOnStop() = LocalResultPoi
			// 																		/	getGetOffStop() = LocalResultPoi
			// 																		/	getPath() = Array<Point>
			// 																		/	getPolyline() = PolyLine /
			// 																				/	Polyline(points:Array<Point>[, opts:PolylineOptions])
			// 																				/	
			// 																				/
			// 																				/
			// 																				/
			// 																		/	getDistance([format:Boolean]) = number | String
			// 																		/
			// 										/	getNumRoutes() = Route
			// 										/	getDistance([format:Boolean]) = number | String
			// 										/	getDuration([format:Boolean]) = number | String
			// 										/	getDescription([includeHtml:Boolean]) = String
			//
			ME.stopSpinner();
			ME.showHidePanel();
			ERROR("@@@@@transit result:" + result);
		},

	startSpinner: function(){
			ME.spinnerShowed = true;
			if(! ME.larryCookie)
				ME.larryCookie = new larryCookie();
			var h = parseInt(ME.larryCookie.devInfo.winHeight);
			var w = parseInt(ME.larryCookie.devInfo.winWidth);
			var styleSpinner = "display:block;top:" + ((h - 128) / 2) + "px;left:" + ((w - 128) / 2) + "px;";
			ME.controller.get("updaterSpinner").mojo.start();
			ME.controller.get("updaterSpinner").setStyle(styleSpinner);
			ME.showMask();
		},

	stopSpinner: function(){
			ME.spinnerShowed = false;
			ME.controller.get("updaterSpinner").mojo.stop();
			ME.controller.get("updaterSpinner").setStyle("display: none");
			if(! ME.panelShowed && ! ME.boxShowed){
					ME.hideMask();
				}
		},

	forceHideSpinner: function(){
			ME.stopSpinner();
		},
	
	prepareMapAPI: function(T){
		if (T.apiInfoDATA && T.apiInfoDATA.apiReady == true && T.apiInfoDATA.jsReady == true && T.apiInfoDATA.cssReady == true){
			if(! T.apiLoaded){
				T.showBox("即将打开地图,请稍等...", "");
				T.closeBox();
				var self = T;
				T.loadAPI(T);
				setTimeout(function(){
					if(! self.mapReady)
						self.createMapNode(self);
				}, 2000);
			}
		} else {
			// 关联"larrymaps://"协议，以快速启动Larry Maps并定位指定位置
			// 在里关联，时间还算合适吧?
			ME.addRedirectHandler();
			T.apiInfoCookie.put({"jsReady": "false", "cssReady": "false", "apiReady": "false", "version": "null", "lastUpdated": "从未下载"});
			Mojo.Controller.stageController.activeScene().showAlertDialog({
				onChoose: function(val){
					if(val == "download"){
						var DL = new APIUpdater();
						T.startSpinner();
						if(T.chkApiTimer){
								clearInterval(T.chkApiTimer);
								T.chkApiTimer = undefined;
							}
						// 这个定时器用于更新与API相关的提示内容
						T.chkApiTimer = setInterval(function(){
							ME.updateTopRightBox("正在<br>下载API...");
							api = (new Mojo.Model.Cookie("apiInfoCookie")).get();
							if(api){
								if(api.cssReady == true){
									ME.showBox("Map API css 已就绪...", "正在继续..." + ME.getDateTime());
									}
								if(api.jsReady == true){
									ME.showBox("Map API js 已就绪...", "正在继续..." + ME.getDateTime());
									}
								if(api.apiReady == true){
										if(! ME.apiLoaded)
											ME.loadAPI(ME);
										delete DL;
										ME.stopSpinner();
										ME.showBox("API文件已经全部下载完毕!", "正在继续..." + ME.getDateTime());
										var f = function(){
											ME.showBox("正在加载API!", "等待中..." + ME.getDateTime());
											if(typeof(BMap) != undefined){
													ME.closeBox();
													if(! ME.mapReady)
														ME.createMapNode(ME);
													clearInterval(ME.confirmApiLoadedTimer);
													ME.confirmApiLoadedTimer = undefined;
												}
											}
										ME.confirmApiLoadedTimer = setInterval(f, 1500);
										clearInterval(ME.chkApiTimer);
										ME.chkApiTimer = undefined;
								}
							}
						}, 1000);
					}else{
						T.showBox("还没准备API,正等待你的操作...", "你刚才没有选择开始");
						}
					},
				preventCancel: false,
				allowHTMLMessage: true,
				title: "Larry Maps需要更新API",
				message: $L("首次运行Larry Maps或者上次更新API不成功, 均需要下载API文件才能正确运行, <br>提示下载完成后，将<font color='green'>自动打开地图</font>. <br>如果以后发现地图不能正常使用, 可以从<font color='green'>菜单</font>进入<font color='green'>设置</font>页面进行<font color='red'>手动更新API</font>."),
				choices: [{label: $L("开始下载"), value: "download", type: "affirmative"},{label: $L("稍后再试"), value: "NOP", type: "negative"}]
			});
		}
	},
	
	checkNetwork: function(T){
		T.showBox("等待可用的网络连接...", "");
		T.closeBox();
		T.updateTopRightBox("正在等待<br>网络连接...");
		// closeBox默认是1300毫秒关闭的
		setTimeout(T.startSpinner, 1500);
		var R = T.controller.serviceRequest(
			"palm://com.palm.connectionmanager",
			{
			method: "getstatus",
			parameters: {subscribe: true},
			onSuccess: function(evt){
					if(evt.isInternetConnectionAvailable){
						T.stopSpinner();
						T.closeBox();
						T.networkAvailable = true;
						T.controller.get("goNoNetworkHelp").style.display = "none";
						T.prepareMapAPI(T);
					}
				}.bind(T),
			onFailure: function(evt){
				ERROR("@@@@@ ServiceRequest for palm://com.palm.connectionmanager: Failure!!!");
				}.bind(T)
			});
	},
	
	showBox: function(msg, bttnTxt){
			ME.boxShowed = true;
			if(! msg || msg == "")
				return false;
			var bttnText;
			if(! bttnTxt || bttnTxt == "")
				bttnText = "";
			else
				bttnText = bttnTxt;
			var content = msg;
			var g = ME.controller.get;
			g("larry").setStyle("display: block; opacity: 0.5;");
			g("larrymask").setStyle("display: block; opacity: 0.3;");
			g("content").innerHTML = content;
			g("plnTxt").innerHTML = bttnText;
		},

	closeBox: function(t){
			ME.boxShowed = false;
			ME.controller.get("larry").setStyle("display: none; opacity: 0;");
			if(! ME.panelShowed && ! ME.spinnerShowed){
					ME.hideMask();
				}
			var self = this;
			var timeout = 1300;
			if(typeof(t) == "number"){
					timeout = parseInt(t);
				}
			var f = function(){
				var g = self.controller.get;
				g("content").innerHTML = "Larry Maps正在为你运行";
				g("plnTxt").innerHTML = ";-)";
				g("larry").setStyle("display: none; opacity: 0.5;");
				g("larrymask").setStyle("display: none; opacity: 0.3;");
				self.showBoxPending = false;
				};
			setTimeout(f, timeout);
		},
	
	loadAPI: function(T) {
			if(! this.apiLoaded){
				try{
				var apiJSElement = new Element("script", {"src": "/media/cryptofs/apps/usr/palm/applications/cn.choetin.larry.maps/javascripts/baidu-maps-api.js", "type": "text/javascript"});
				var apiCSSElement = new Element("script", {"href": "/media/cryptofs/apps/usr/palm/applications/cn.choetin.larry.maps/stylesheets/baidumaps.css", "media": "screen", "rel": "stylesheet", "type": "text/css"});
				T.controller.window.document.body.appendChild(apiCSSElement);
				T.controller.window.document.body.appendChild(apiJSElement);
				} catch(e) {
					ERROR("@@@@@ larrymaps#loadAPI error: " + e);
				}
				return (T.apiLoaded = true);
			}
		},
		
	createMapNode: function(T){
			// 让心急的用户镇定一点，来个转圈
			// 加载地图是需要一点时间的，这点时间内，地图是空白的（像白屏那样）
			T.startSpinner();
			T.controller.get("map").style.display = "block";
			// 设定地图类型
			var mapTypeRead = T.larryCookie.lastViewMapType;
			ME.gblMapType = mapTypeRead;
			var mapType;
			switch(mapTypeRead){
				case "MAP":
					mapType = BMAP_NORMAL_MAP;
					ME.controller.get("rcontent").setStyle("color: black");
					break;
				case "SAT":
					mapType = BMAP_SATELLITE_MAP;
					ME.controller.get("rcontent").setStyle("color: white");
					break;
				case "PER":
					mapType = BMAP_PERSPECTIVE_MAP;
					break;
				case "HYB":
					mapType = BMAP_HYBRID_MAP;
					ME.controller.get("rcontent").setStyle("color: white");
					break;
				default:
					mapType = BMAP_NORMAL_MAP;
					ME.controller.get("rcontent").setStyle("color: black");
					break;
				}
			if(typeof(BMap) != undefined)
				T.map = new BMap.Map("map", {enableHighResolution: true});
			T.map.setMapType(mapType);
			T.minZoom = mapType.getMinZoom();
			T.maxZoom = mapType.getMaxZoom();
			if(T.mapZoomLevel < T.minZoom || T.mapZoomLevel > T.maxZoom)
				T.mapZoomLevel = 16;

			if(T.updateMapPoint()){
					var point;
					if(ME._LaunchedWithParams){ // 是带参数启动的
						point = ME.calcPoint(ME._LaunchedWithParams._lat, ME._LaunchedWithParams._lon, ME._LaunchedWithParams._oslat, ME._LaunchedWithParams._oslon);
					}else{
						if(! ME.larryCookie)
							ME.larryCookie = new larryCookie();
						if(ME.larryCookie.privateOffset.enabled){
							point = ME.calcPoint(T.mapLat, T.mapLon, T.larryCookie.privateOffset.lat, T.larryCookie.privateOffset.lon);
							}
						}
					T.map.centerAndZoom(point, T.mapZoomLevel);
					T.setMapType(T.gblMapType);
					if(ME.params && ME.params.target){
						//ME.placeGpsMarker(point, {'url': 'images/palm-default/star-on.png', 'width': 24, 'height': 24, 'ox': 12, 'oy': 12});
						ME.placeGpsMarker(point, {'url': 'images/markers.png',
												'width': 23, 'height': 25,
												'ox': 10, 'oy': 25
												});
						}
				}else{
					// 什么都不定义，显示到一个特定的位置 
					T.map.centerAndZoom(new BMap.Point(110.285375, 25.213604), 5);
				}
			ME.updateTopRightBox();
			// 地图已经就绪
			T.mapReady = true;
			Mojo.Event.listen(
					T.controller.get("map"),
					Mojo.Event.hold,
					T.handleMapHold.bind(T)
				);
			Mojo.Event.listen(
					T.controller.get("map"),
					Mojo.Event.tap,
					T.handleMapTap.bind(T)
				);

			// 用于手势缩放地图
			this.listenGestureEvents();
			// 用于拖拽地图
			this.listenDragEvents();
			// 按住以选择发送位置
			this.controller.listen(
				this.controller.get("rcontent"),
				Mojo.Event.hold,
				this.handleRcontentHold.bind(this)
				);
	
			T.closeBox(2000);
			this.blurSearchBar();
			this.setupSearchStuff();
			setTimeout(
					function(){
							// 是时候不停转了，不逗你了
							// 显然，我们可以监听ME.map的load事件来决定这个转圈什么时候停
							ME.stopSpinner();
						},
					2000
				);
			return true;
		},

	updateMapPoint: function(lat, lon, zoom){
		try{	
			if(ME.larryCookie)
				delete ME.larryCookie;
			ME.larryCookie = new larryCookie();

			// 带参数时，仅更新我们坐标的全局变量
			if(lat && lon && zoom){
					ME.mapLat = lat;
					ME.mapLon = lon;
					ME.mapZoomLevel = zoom;
				}else{
						// 读取COOKIE保存的坐标，以显示上次关闭larry maps时的位置
						ME.mapZoomLevel = parseInt(ME.larryCookie.lastViewPoint.level);
						ME.mapLat = ME.larryCookie.lastViewPoint.lat;
						ME.mapLon = ME.larryCookie.lastViewPoint.lon;
						// 如果带参数运行，打开从参数中获取的坐标位置
						if(ME.params && ME.params.target){
							// 检测格式是否符合,不知道是不是很有必要
							// 这个正则好像会很复杂
							// N 为N位的整数, S为字符串
							// larrymaps://lat=N[.N]&lon=N[.N]&z=N&t=S&oslat=N[.N]&oslon=N[.N]
							var tmpVar = ME.params.target;
							var statOK = true;
							tmpVar = tmpVar.toLowerCase();
							//if(/^larrymaps\/\//.test(tmpVar){
							if(tmpVar.indexOf("larrymaps://") == 0 && tmpVar.indexOf("lat=") && tmpVar.indexOf("lon=") && tmpVar.indexOf("z=") && tmpVar.indexOf("&")){
									tmpVar = tmpVar.replace("larrymaps://", "");
									tmpVar = tmpVar.split("&");
									for(var i=0; i<tmpVar.length; i++){
											if(tmpVar[i].indexOf("lat") == 0)
												{var _lat = parseFloat(tmpVar[i].split("=")[1]);}
											if(tmpVar[i].indexOf("lon") == 0)
												{var _lon = parseFloat(tmpVar[i].split("=")[1]);}
											if(tmpVar[i].indexOf("z") ==0)
												{var _level = parseInt(tmpVar[i].split("=")[1]);}
											if(tmpVar[i].indexOf("t") ==0)
												{var _type = tmpVar[i].split("=")[1];}
											if(tmpVar[i].indexOf("oslat") ==0)
												{var _oslat = parseFloat(tmpVar[i].split("=")[1]);}
											if(tmpVar[i].indexOf("oslon") ==0)
												{var _oslon = parseFloat(tmpVar[i].split("=")[1]);}
										}
							}
							// 只有提供lat,lon,zoomlevel时，才打开参数的位置
							if(_lat && _lon && _level){
									// 是时候更新全局坐标变量了
									ME.mapLat = _lat;
									ME.mapLon = _lon;
									ME.mapZoomLevel = _level;
									ME.gblMapType = _type ? _type.toUpperCase() : ME.gblMapType;
									// 此对象告诉mapGoto()及createMapNode()，我们是被其它程序带参数启动的,使用参数的偏移量
									ME._LaunchedWithParams = {"_lat": _lat, "_lon": _lon, "_oslat": _oslat, "_oslon": _oslon, "_level": _level};
									// 如果有偏移量提供，提示用户是否保存所提供的偏移量
									if(_oslat && _oslon && parseFloat(_oslat) != ME.larryCookie.privateOffset.lat && parseFloat(_oslon) != ME.larryCookie.privateOffset.lon){
											var offset = {"oslat": _oslat,"oslon": _oslon};
											var save_them = function(choice){
													if(choice == "save"){
															var cookie = new larryCookie();
															cookie.savePrivateOffset({"enabled": true, "lat": offset.oslat, "lon": offset.oslon});
															delete cookie;
														}
													if(choice == "copy"){
															ME.controller.stageController.setClipboard("偏移量lat/lon: " + offset.oslat + "," + offset.oslon);
														}
												};
											Mojo.Controller.stageController.activeScene().showAlertDialog({
													title: "检测到有偏移量",
													allowHTMLMessage: true,
													message: "Larry Maps检测到新偏移量:<br>" +
															 "lat偏移量: <font color='green'><b>" + _oslat + "</b></font><br>" +
															 "lon偏移量: <font color='green'><b>" + _oslon + "</b></font><br>" +
															 "<font size='4'>你想保存这个偏移量吗?</font>",
													onChoose: save_them,
													choices:[
															{label: "使用并保存", value: "save", type: "negative"},
															{label: "复制到剪贴板", value: "copy", type: "affirmative"},
															{label: "忽略", value: "ignore", type: "dismiss"}
														]
												});
										}
									// 改变搜索条内容为参数提供的内容
									ME.controller.get("searchBar").mojo.setText("Go " + ME.mapLat + "," + ME.mapLon + "," + ME.mapZoomLevel);
								}
							//}
						}
					}
			return true;
			}catch(e){
					ERROR("@@@@@ larrymaps#updateMapPoint# ERROR: "+e);
					return false;
				}
		},
		
	handleMapTap: function(evt){
			ME.placeMarker(ME.map.pixelToPoint(new BMap.Pixel(evt.x, evt.y)));
			if(! ME.searchBarFocused){
				if(ME.inDrag || ME.inGesture)
					return;
				//
				// inspecting inside infowindow - it's a buggy info box on pixi.
				//
				//ERROR(ME.controller.get("panelContent").innerHTML);
			}else{
					ME.blurSearchBar();
				}
		},
	
	handleMapHold: function(evt){
			if(! ME.searchBarFocused){
				if(ME.inDrag || ME.inGesture)
					return;
				ME.showEmailButton({'x': evt.down.x, 'y': evt.down.y});
			}else{
					ME.blurSearchBar();
				}
		},

	handleSearchBarTap: function(evt){
			if(this.apiLoaded){
					ME.focusSearchBar();
				}else{
					evt.stop();
					ME.blurSearchBar();
				}
		},

	handleSearchBarPropertyChange: function(evt){
			var v = evt.value;
			// 定义一些快捷方式 - Most likely "Just type".
			if(v == "Go" || v == "go")
				ME.controller.get("searchBar").mojo.setText("Go ");
			if(v == "Go 0")
				ME.controller.get("searchBar").mojo.setText("Go 0,0,");
			if(v.indexOf("Go ") ==  0 && v.indexOf(",") > 3){
					v = v.split(" ");
					v = v[1];
					v = v.split(",");
					_lat = v[0] ? parseFloat(v[0]) : undefined;
					_lon = v[1] ? parseFloat(v[1]) : undefined;
					_z = v[2] ? parseInt(v[2]) : undefined;
					if(_lat && _lon && _z){
						ME.stopTracking();
					}
					ME.mapGoto({'lat': _lat, 'lon': _lon, 'zoom': _z});
					return;
				}
			if(v != "." && /^\.(map||sat||hyb||per)$/.test(v)){
					ME.setMapType(v.replace("\.", "").toUpperCase());
					return;
				}
			if(v == ".register"){
					this.addRedirectHandler();
					return;
				}
			if(v == ".unregister"){
					this.removeRedirectHandler();
					return;
				}
		},

	calcPoint: function(lat, lon, oslat, oslon){
			if(!(lat, lon, oslat, oslon))
				return null;
			if(typeof(BMap) == undefined)
				return null;
			var _lat = (parseFloat(lat) + parseFloat(oslat)).toFixed(6);
			var _lon = (parseFloat(lon) + parseFloat(oslon)).toFixed(6);
			return (new BMap.Point(_lon, _lat));
		},

	// 改变坐标或者放大级别
	mapGoto: function(obj){	
			try{
			if(! ME.mapReady)
				return;
			if(ME.larryCookie)
				delete ME.larryCookie;
			ME.larryCookie = new larryCookie();

			var point = undefined;
			if(obj.lat && obj.lon){ // 是否改变坐标
				// 显然，点击进行移动地图或者拖动地图时，是不能用偏移量的，但需要更新全局坐标变量
				if(obj.fromAction != "tap" && obj.fromAction != "drag"){ 
						// 这不是点击地图
						// ME._LaunchedWithParams 存在，则使用其保存的偏移量
						if(ME._LaunchedWithParams){
								// 搜索条内容改变，会在这儿来一下子的
								// 我们把它消灭掉，这样世界才平安
								// 因为createMapNode()已经做好这一切了
								// // 由于这里已经返回了，所以zoom级别无法生效
								// // 所以我们在这里重新进入一次
								ME.mapGoto({'zoom': ME._LaunchedWithParams._level});
								ME._LaunchedWithParams = undefined;
								return;
							}
						// 同时看COOKIE内设置是否启用偏移量
						if(ME.larryCookie.privateOffset.enabled && !ME._LaunchedWithParams){ // 是否使用偏移量
								point = ME.calcPoint(obj.lat, obj.lon, ME.larryCookie.privateOffset.lat, ME.larryCookie.privateOffset.lon);
							}else{ // 不使用偏移量
									point = new BMap.Point(parseFloat(obj.lon), parseFloat(obj.lat));
								}
						// 更新我们的全局坐标变量
						ME.mapLat = obj.lat;
						ME.mapLon = obj.lon;
					}else{ // 这是点击地图的或拖动地图的
							point = new BMap.Point(obj.lon, obj.lat);
							// 更新我们的全局坐标变量
							if(ME.larryCookie.privateOffset.enabled){
								ME.mapLat = (parseFloat(obj.lat) - parseFloat(ME.larryCookie.privateOffset.lat)).toFixed(6);
								ME.mapLon = (parseFloat(obj.lon) - parseFloat(ME.larryCookie.privateOffset.lon)).toFixed(6);
								}else{
									ME.mapLat = obj.lat;
									ME.mapLon = obj.lon;
									}
						}
				}else{ // 不是改变坐标的
						point = ME.map.getCenter();
					}
				if(point){
						ME.map.panTo(point);
						// 我们是否处于GPS定位，是则放一个标志在地图上
						if(ME.trackMeTimer && obj.fromAction == "gps")
							ME.placeGpsMarker(point);
					}
			if(obj.zoom && obj.zoom != ME.mapZoomLevel && obj.zoom >= ME.minZoom && obj.zoom <= ME.maxZoom){
					// 如果不是从缩放手势来到这儿,我给显示一个缩放的动画效果
					if(obj.fromAction != "gestureEnd"){
						var r = 1;
						var style = "";
						if (obj.zoom < ME.mapZoomLevel){
							for(var i=0; i< ME.mapZoomLevel - obj.zoom; i++)
								r *= 0.5;
							style = "-webkit-transform: scale(" + r + ");-webkit-transition: -webkit-transform 0.1s ease-in;";
						}else{
							for(var i=0; i< obj.zoom - ME.mapZoomLevel; i++)
								r *= 2;
							style = "-webkit-transform: scale(" + r + ");-webkit-transition: -webkit-transform 0.1s ease-out;";
							}
						ME.controller.get("map").setStyle(style);
					}

					setTimeout(function(){
						ME.map.setZoom(obj.zoom);
						var how = "";
						style = ""
						if(obj.zoom < ME.mapZoomLevel){
								how = "ease-in";
							}else{
									how = "ease-out";
								}
						style = "-webkit-transition: none "/* + how*/ + ";-webkit-transform: scale(1);";
						ME.controller.get("map").setStyle(style);
						style = "-webkit-transition: -webkit-transform 0.1s " + how + ";-webkit-transform: scale(1);";
						ME.mapZoomLevel = obj.zoom;
						}, 800);
				}
			var zoom = obj.zoom || ME.mapZoomLevel;
			if(ME.larryCookie.speedUnit == "kmph"){
				var speed = parseInt(ME.speed * 3.6) + "km/s";
			}else{ // 其它情况用m/s, COOKIE值应为 'mps'
					var speed = parseFloat(ME.speed).toFixed(1) + "m/s";
				}
			ME.updateTopRightBox(parseFloat(ME.mapLat).toFixed(6) + "<br>" + parseFloat(ME.mapLon).toFixed(6) + "<br>" + parseInt(zoom) + "z/" + speed);
			ME.larryCookie.updateLastViewPoint({"lat": ME.mapLat, "lon": ME.mapLon, "level": zoom});
			delete ME.larryCookie;
			}catch(e){
					ERROR("@@@@@ larrymaps#mapGoto got ERRORs: " + e);
				}
		},

	getDateTime: function(){
		var now = new Date();
		var timeS = now.getHours() +":"+ now.getMinutes() +"." + now.getSeconds() + " "+ now.getMonth() +"/"+ now.getDate();
		return timeS;
		},

	_trackMe: function(){
			timeS = ME.getDateTime();
			if(! ME.GPS)
				ME.GPS = new GPS(ME);
			ME.GPS.track();
			var rtnValue = ME.GPS.get();
			if(rtnValue.isGpsReady){
					var fP = new BMap.Point(rtnValue.old.lon, rtnValue.old.lat);
					var sP = new BMap.Point(rtnValue.gps.lon, rtnValue.gps.lat);
					var tSpeed = ME.map.getDistance(fP, sP);
					if(typeof(tSpeed) != "number")
						tSpeed = 0.0;
					ME.speed = tSpeed.toFixed(1);
					ME.mapGoto({'lat': rtnValue.gps.lat, 'lon': rtnValue.gps.lon, 'fromAction': 'gps'});
					delete fP;
					delete sP;
				}else if(! ME.showBoxPending){
					if(ME.gpsTipTimeout){
							clearTimeout(ME.gpsTipTimeout);
							ME.gpsTipTimeout = undefined;
						}
						if(rtnValue.gps.errorText == ""){
							var f = function(){
								ME.closeBox();
								};
							ME.gpsTipTimeout = setTimeout(f, 2000);
							ME.showBox("正在初始化GPS,这可能需要几分钟...", timeS);
						}else{
								ME.showBox("GPS初始化状态:<br>"+rtnValue.gps.errorText, timeS);
							}
					}
		},

	placeGpsMarker: function(point, imgObj){
			if(! (point instanceof BMap.Point))
				return;
			ME.map.removeOverlay(this.gpsMarker);
			var gpsPoint = point;
			var gpsMarkerIconSize = new BMap.Size(((imgObj && imgObj.width) ? imgObj.width : 46), ((imgObj && imgObj.width) ? imgObj.width : 46));
			var gpsMarkerIconAnchor = new BMap.Size(((imgObj && imgObj.ox) ? imgObj.ox : 23), ((imgObj && imgObj.oy) ? imgObj.oy : 23));
			var gpsMarkerIcon = new BMap.Icon(((imgObj && imgObj.url) ? imgObj.url : "images/gps-cross.png"),
					gpsMarkerIconSize,
					{
						anchor: gpsMarkerIconAnchor
					}
				);
			this.gpsMarker = new BMap.Marker(
					gpsPoint,
					{
						icon: gpsMarkerIcon
					}
				);
			ME.map.addOverlay(this.gpsMarker);
		},

	placeMarker: function(point, imgObj){
			if(! (point instanceof BMap.Point))
				return;
			if(ME._marker){
					ME.map.removeOverlay(ME._marker);
					ME._marker = undefined;
				}
			var poi = point;
			var iconSize = new BMap.Size(((imgObj && imgObj.width) ? imgObj.width : 24), ((imgObj && imgObj.width) ? imgObj.width : 24));
			var iconAnchor = new BMap.Size(((imgObj && imgObj.ox) ? imgObj.ox : 0), ((imgObj && imgObj.oy) ? imgObj.oy : 0));
			var icon = new BMap.Icon(((imgObj && imgObj.url) ? imgObj.url : "images/palm-default/star-on.png"),
					iconSize,
					{
						anchor: iconAnchor
					}
				);
			ME._marker = new BMap.Marker(
					poi,
					{
						icon: icon
					}
				);
			return ME.map.addOverlay(ME._marker);
		},
	
	startTracking: function(interval){
			if(this.trackMeTimer)
				return;
			if(interval && interval > 1000){
				this.trackMeTimer = setInterval(this._trackMe, interval);
			}else{
				this.trackMeTimer = setInterval(this._trackMe, 1000);
			}
			this.cmdMenuModel.items[0].iconPath = "images/GPS-on.png";
			this.controller.modelChanged(this.cmdMenuModel);
		},

	stopTracking: function(opts){
			if(! this.trackMeTimer)
				return;
			clearInterval(this.trackMeTimer);
			this.trackMeTimer = undefined;
			ME.GPS.stop();
			this.cmdMenuModel.items[0].iconPath = "images/GPS-off.png";
			this.controller.modelChanged(this.cmdMenuModel);
			this.speed = 0;
			if(opts && opts == "silent")
				return;
			this.showBox("貌似你已经停止使用GPS定位!!!!","好吧,信不信由你,反正我是信了");
			this.closeBox(1500);
		},

	setMapType: function(mapType){
			if(typeof(mapType) != "string")
				return;
			else
				mapType = mapType.toUpperCase();
			ME.gblMapType = mapType;
			if(!  ME.larryCookie)
				ME.larryCookie = new larryCookie();
			var msg;
			switch(mapType){
				case "MAP":
					ME.map.setMapType(BMAP_NORMAL_MAP);
					ME.controller.get("rcontent").setStyle("color: black");
					msg = "普通街道";
					break;
				case "PER":
					ME.map.setMapType(BMAP_PERSPECTIVE_MAP);
					msg = "透视视图";
					break;
				case "SAT":
					ME.map.setMapType(BMAP_SATELLITE_MAP);
					ME.controller.get("rcontent").setStyle("color: white");
					msg = "卫星";
					break;
				case "HYB":
					ME.map.setMapType(BMAP_HYBRID_MAP);
					ME.controller.get("rcontent").setStyle("color: white");
					msg = "卫星路网";
					break;
				default:
					ME.map.setMapType(BMAP_NORMAL_MAP);
					ME.controller.get("rcontent").setStyle("color: black");
					msg = "普通街道";
					break;
				}
			msg = "进入" + msg + "地图模式";
			ME.showBox(msg, "正在加载...");
			ME.updateTopRightBox();
			ME.minZoom = ME.map.getMapType().getMinZoom();
			ME.maxZoom = ME.map.getMapType().getMaxZoom();
			if(ME.mapZoomLevel < ME.minZoom || ME.mapZoomLevel > ME.maxZoom){
				ME.mapZoomLevel = 16;
				ME.map.setZoom(ME.mapZoomLevel);
				}
			ME.larryCookie.updateLastViewMapType(mapType);
			ME.larryCookie.updateLastViewPoint({lat: ME.mapLat, lon: ME.mapLon, level: ME.mapZoomLevel});
			this.updateTopRightBox();
			ME.closeBox(2000);
			ME.showBoxPending = true;
		},

	blurSearchBar: function(){
			var sb = ME.controller.get("searchBar");
			var sbi = ME.controller.get("searchBarGoIcon");
			sb.mojo.blur();
			sb.removeClassName("focus");
			sb.addClassName("blur");
			sbi.removeClassName("tapable");
			sbi.addClassName("graydown");
			ME.searchBarFocused = false;
		},

	focusSearchBar: function(){
			var sb = ME.controller.get("searchBar");
			var sbi = ME.controller.get("searchBarGoIcon");
			sbi.removeClassName("graydown");
			sbi.addClassName("tapable");
			sb.removeClassName("blur");
			sb.addClassName("focus");
			ME.searchBarFocused = true;
		},

	updateTopRightBox: function(content){
			var strHTML;
			if(! ME.larryCookie)
				ME.larryCookie = new larryCookie();
			if(ME.larryCookie.speedUnit == "kmph"){
				var speed = parseInt(ME.speed * 3.6) + "km/s";
			}else{ // 其它情况用m/s, COOKIE值应为 'mps'
					var speed = parseFloat(ME.speed).toFixed(1) + "m/s";
				}
			if(! content)
				strHTML = parseFloat(ME.mapLat).toFixed(6) + "<br>" + parseFloat(ME.mapLon).toFixed(6) + "<br>" + ME.mapZoomLevel + "z / " + speed;
			else
				strHTML = content;
			ME.controller.get("rcontent").innerHTML = strHTML;
		},

	handleDocumentKeyUp:function(evt){
			if(Mojo.Char.isEnterKey(evt.keyCode)){
					ME.blurSearchBar();
					ME.startToSearch();
				}else{
					}
		},

	handleGestureStart: function(evt){
			if(ME.inDrag){
					evt.stop();
					return;
				}
			ME.inGesture = true;
			ME.inGrag = false;
			//ERROR("+++++Gesture start+++++scale: " + evt.scale.toFixed(6));
			// 定义一个规则: 如果用户只用双指按一下屏幕,我们缩小一级
			// 方法为: 双指按屏幕后, 产生一个定时器,500毫秒内无手势变动,按缩小一级处理.
			// 有手势变动,则按在Gesture处取消这个定时器. 达到我们的目的.
			var _zoomOutTimerFunc = function(){
					ME.mapGoto({'zoom': ME.mapZoomLevel -1});
					//ERROR("TIMEOUT reach 500ms, zoom out map...");
				};
			ME._zoomOutTimer = setTimeout(_zoomOutTimerFunc, 500);
		},

	handleGestureChange: function(evt){
			if(! ME.inDrag)
				ME.smartMapHelper(evt);
		},

	// 有一个现象是，这个事件经常不能正确的被抓取
	handleGestureEnd: function(evt){
		},

	handleDragStart: function(evt){
			if(ME.inGesture){
					evt.stop();
					return;
				}
			ME.inDrag = true;
			ME.inGesture = false;
			//ERROR("+++++Drag start+++++down x,y: " + evt.down.x + "," + evt.down.y);
			ME.stopTracking("silent");
			ME.gblDraggingEventXY = undefined;
			ME.gblDraggingEventXY = {'x': evt.down.x, 'y': evt.down.y, 'oldx': evt.down.x, 'oldy': evt.down.y};
		},

	handleDragChange: function(evt){
			if(! ME.inGesture)
				ME.smartMapHelper(evt);
		},

	// 有一个现象是，这个事件经常不能正确的被抓取
	handleDragEnd: function(evt){
		},
	
	// 定义一个聪明的助手，统一处理dragging及gestureChane事件.
	// 助手会根据参数自动决定是拖动地图还是缩放地图:
	// 		要知道，Drag及Gesture事件的event内涵是不一样的 :-)
	// 做这个决定，原因是那个DragEnd及GestureEnd事件是非常不稳定的
	//  :: 另外，在进行gesture操作时，经常也会有hold事件跑出来，
	//  我决定用inDrag及inGesture来禁止hold事件处理其它操作
	//
	smartMapHelper: function(evt){
			try{
			if(evt.move){ // 显然,这是拖动的事件
					if(ME.inGesture)
						return;
					// 实时反映拖动效果
					var style = "left:" + (evt.move.x - ME.gblDraggingEventXY.x + (0 - (ME.w/2))) + "px;";
					style = style + "top:" + (evt.move.y - ME.gblDraggingEventXY.y + (0 - (ME.h/2))) + "px;";
					ME.controller.get("map").setStyle(style);
					if(ME._dragTimer){
							// 如果运行到这里,说明dragging还在继续
							// 清空这个处理DragEnd的定时器
							clearTimeout(ME._dragTimer);
							ME._dragTimer = undefined;
						}
					// 这是DragEnd要做的事
					ME._dragTimerFunc = function(){							
							// 有时，DragStart事件不发生，也会有DragEnd事件，这导致ME.gblDraggingEventXY未定义
							// 这里确保一下ME.gblDraggingEventXY是存在的
							if(! ME.gblDraggingEventXY && ME.inGesture)
								return;
							offset = {'ox': evt.move.x - ME.gblDraggingEventXY.x, 'oy': evt.move.y - ME.gblDraggingEventXY.y};
							ME.map.panBy(offset.ox, offset.oy, {noAnimation: true});
							// 这个定时器是获取新的中心点坐标，更新到全局坐标变量
							// 听说地图拖动动画是200毫秒, 我们设定700毫秒再获取
							setTimeout(function(){
									var center = ME.map.getCenter();
									ME.mapGoto({'lat': center.lat, 'lon': center.lng, "fromAction": "drag"});
									//ERROR("SMART - MAP - HELPER: lat/lon: " + center.lat + "/" + center.lng);
								}, 700);
							if(ME._dragTimer)
								ME._dragTimer = undefined;
							// Drag事件已经结束
							ME.inDrag = false;
							//ERROR("-----Drag end-----move x,y: " + evt.move.x + "," + evt.move.y);
							// 不再相信DragEnd
							// 恢复地图原来位置(0,0)
							var style = "top:" + (0 - (ME.h/2)) + "px;left:" + (0 - (ME.w/2)) + "px;";
							ME.controller.get("map").setStyle(style);
							//ERROR(style);
							os = "offsets -> x,y: " + (evt.move.x - ME.gblDraggingEventXY.x) + "," + (evt.move.y - ME.gblDraggingEventXY.y);
							//ERROR(os);
							if(! ME.inGesture)
								ME.controller.stopListening(
										ME.controller.get("map"),
										Mojo.Event.dragging,
										ME.handleDragChange.bind(ME)
									);
						};
					// 500毫秒没有dragging事件，我们确定dragEnd已经发生
					ME._dragTimer = setTimeout(ME._dragTimerFunc, 500);
				}else if(evt.scale){ // 好吧，是缩放了
							if(ME.inDrag)
								return;
							// 对于, 双指按屏幕缩小一半的定时器而言,
							// 运行到这里, 说明用户已经不是双指按一下屏幕了,
							// 如果用户没有进行'缩放', scale值应该会在 0.97 ~ 1.03之间
							// 条件满足,我们就取消自动缩小一级的操作.
							if(ME._zoomOutTimer && ! (evt.scale <= 1.03 && 0.97 <= evt.scale)){
									clearTimeout(ME._zoomOutTimer);
									ME._zoomOutTimer = undefined;
									//ERROR("GESTURE CHANGE out-bound(0.97~1.03)! Cancel auto zooming out!!!");
								}
							// 实时反映缩放效果
							var style = "-webkit-transition: -webkit-transform 0.01s ease-in;-webkit-transform:scale("+evt.scale+");";
							ME.controller.get("map").setStyle(style);
							ME.updateTopRightBox("Scale<br><font color='white'>" + evt.scale.toFixed(6) + "</font><br>mapZoom");
							if(ME._gestureTimer){
									// 如果运行到这里,说明GestureChange还是继续
									// 清空这个处理DestureEnd的定时器
									clearTimeout(ME._gestureTimer);
									ME._gestureTimer = undefined;
								}
							// 这是GestureEnd要做的事
							ME._gestureTimerFunc = function(){
									// 改变地图放大级别
									if(evt.scale > 1.03){
										ME.mapGoto({'zoom': ME.mapZoomLevel+parseInt(evt.scale), 'fromAction':  "gestureEnd"});
										//ERROR("scale: +" + parseInt(evt.scale));
										}
									if(evt.scale < 0.97){
										ME.mapGoto({'zoom': ME.mapZoomLevel-parseInt(1/evt.scale), 'fromAction': "gestureEnd"});
										//ERROR("scale: -" + parseInt(1/evt.scale));
										}
									if(ME._gestureTimer)
										ME._gestureTimer = undefined;
									// Gesture事件已经结束
									ME.inGesture = false;
									//ERROR("------Gesture End-----scale: "+  evt.scale.toFixed(6));
									// 不再相信 GestureEnd
									// 因为mapGoto在改变缩放级别的时候,动画是200毫秒,
									// 所以我们在700毫秒后,恢复原来放大级别(1)
									setTimeout(function(){
											var scale1 = "-webkit-transition: none "/* + how*/ + ";-webkit-transform: scale(1);";
											ME.controller.get("map").setStyle(scale1);
											var resume = "-webkit-transition: -webkit-transform 0.1s ease-in;-webkit-transform: scale(1);";
											ME.controller.get("map").setStyle(resume);
										}, 700);
									if(! ME.inDrag)	
										ME.controller.stopListening(
												ME.controller.document,
												"gesturechange",
												ME.handleGestureChange.bind(ME)
											);
									};
							// 500毫秒没有GestureChange事件，我们认为是GestureEnd了
							ME._gestureTimer = setTimeout(ME._gestureTimerFunc, 500);
						}
			}catch(e){
					ERROR("@@@@@ larrymaps#smartMapHelper gots ERRORs: " + e);
				}
		},

	handleRcontentTap: function(evt){
		if(ME.isRcontentScaled){
				ME.controller.get("rcontent").setStyle("-webkit-transform: scale(1);");
				ME.controller.get("realtimeInfo").setStyle("right: -5px;top: 50px;");
				ME.isRcontentScaled = false;
			}else{
					ME.controller.get("rcontent").setStyle("-webkit-transform: scale(1.5);");
					ME.controller.get("realtimeInfo").setStyle("right: 8px;top: 60px;");
					ME.isRcontentScaled = true;
				}
		},

	handlePopupMenuTap: function(cmd){
			switch(cmd){
			case "showPanel":
				this.showHidePanel();	
				break;
			case "changeMapType":
				this.popupSetMapType(this);
				break;
			case "sendPosition":
				this.prepareEmailMsg({'lat': ME.mapLat, 'lon': ME.mapLon, 'zoom': ME.mapZoomLevel});
				break;
			case "getCenterLocation":
				this.getLocationFromPoint(ME.map.getCenter());
				this.showBox("正在查询地图中心点地理...", "请稍候");
				break;
			}
		},

	showHidePanel: function(cmd){
		if(cmd && cmd == "hide"){
				ME.controller.get("panel").style.display = "none";
				ME.panelShowed = false;
				if(! ME.panelShowed && ! ME.boxShowed)
					ME.hideMask();
				return;
			}
		if(ME.panelShowed){
				ME.controller.get("panel").style.display = "none";
				ME.panelShowed = false;
				if(! ME.panelShowed && ! ME.boxShowed)
					ME.hideMask();
			}else{
					ME.controller.get("panel").style.display = "block";
					ME.panelShowed = true;
				}
		},
	
	showMask: function(){
			ME.controller.get("larrymask").setStyle("display: block;");
			ME.controller.get("larrymask").setStyle("opacity: 0.3;");
			//ME.controller.stopListeningDragEvents();
			//ME.controller.stopListeningGestureEvents();
		},

	hideMask: function(){
			ME.controller.get("larrymask").setStyle("display: block; opacity: 0;");
			ME.controller.get("larrymask").setStyle("display: none;");
			//ME.controller.listenDragEvents();
			//ME.controller.listenGestureEvents();
		},

	showEmailButton: function(pos){
			if(ME.inDrag || ME.inGesture)
				return;
			ME.showMask();
			var style = "display: block;-webkit-transform: scale(1);top:" + (pos.y - 16) + "px;left:" + (pos.x - 16) + "px;";
			ME.controller.get("emailButton").setStyle(style);
			var posTrans = pos;
			ME._f = function(){
					ME.prepareEmailMsg(posTrans);
				};
			ME.controller.listen(
					ME.controller.get("emailButton"),
					Mojo.Event.tap,
					ME._f.bind(ME)
				);
		},

	prepareEmailMsg: function(pos){
			if(! pos)
				return;
			ME.hideEmailButton();
			ME.showBox("正在获取地理信息...", "请稍等");
			var point;
			var zoom;
			if(pos.lat && pos.lon)
				point = new BMap.Point(pos.lon, pos.lat);
			else
				point = ME.map.pixelToPoint(new BMap.Pixel(pos.x, pos.y));
			if(pos.zoom)
				zoom = pos.zoom;
			else
				zoom = ME.mapZoomLevel

			if(! ME.larryCookie)
				ME.larryCookie = new larryCookie();
			if(ME.larryCookie.privateOffset.enabled){
					point.lat = (parseFloat(point.lat) - parseFloat(ME.larryCookie.privateOffset.lat)).toFixed(6);
					point.lon = (parseFloat(point.lng) - parseFloat(ME.larryCookie.privateOffset.lon)).toFixed(6);
				}
			var msg = "<br>坐标信息: " + point.lat + "," + point.lng + "<br>";
			
			msg = msg + "放大级别: " + zoom + "<br>";
			var mt = function(arg){
					switch(arg){
						case "MAP":
							return "普通街道地图";
							break;
						case "SAT":
							return "卫星地图";
							break;
						case "HYB":
							return "卫星路网地图";
							break;
						case "PER":
							return "透视地图";
							break;
						}
					return "未指定";
				};
			msg = msg + "地图类型: " + mt(ME.gblMapType) + "<br>";
			msg = msg + "时间: " + ME.getDateTime() + "<br>";
			var link =  "larrymaps://" + 
						"lat=" + point.lat + 
						"&lon=" + point.lng + 
						"&z=" + zoom + 
						"&t=" + ME.gblMapType + 
						"&offsetON=" + ME.larryCookie.privateOffset.enabled + 
						"&oslat=" + ME.larryCookie.privateOffset.lat +
						"&oslon=" + ME.larryCookie.privateOffset.lon;
			var b2g = function(){
				var mt=ME.gblMapType;
				switch(mt){
					case "MAP": return 'roadmap';break;
					case "HYB": return 'hybrid';break;
					case "SAT": return 'satellite';break;
					case "PER": return 'terrain';break;}
				};
			var link_google = "<a href='http://maps.googleapis.com/maps/api/staticmap?" + 
						"center=" + point.lat + "," + point.lng +
						"&zoom=" + zoom +
						"&size=320x400" +
						"&language=zh_CN" + 
						"&sensor=false" + 
						"&markers=color:blue|label:S|" + point.lat + "," + point.lng +
						"&maptype=" + 
						// 转换为googlemaps能识别的地图标识
						(function(){
							var mt=ME.gblMapType;
							switch(mt){
							case "MAP": return 'roadmap';break;
							case "HYB": return 'hybrid';break;
							case "SAT": return 'satellite';break;
							case "PER": return 'terrain';break;}
						}()) + 
						"'>在Google Map上查看</a>";
			msg = msg + link_google +  "<br><a href='" + link + "'>在Larry Maps上查看</a><br>";
			msg = msg + "<font size='-3' color='purple'>链接内容:<br>" + link + "</font><br>";
			var style = "body{padding: 5px;margin: 0px;text-align: left;background: gray;font-size: 14px;}";
			var send = function(v){
					var address;
					address = v.addressComponents.province + v.addressComponents.city + v.addressComponents.district + v.addressComponents.street + v.addressComponents.streetNumber;
					msg = "地址:" + address + msg;
					ME.emailStuff(msg, style);
					ME.stopSpinner();
					ME.closeBox();
				};
			ME.getLocationFromPoint(point, send);
		},
	
	hideEmailButton: function(){
			if(! ME.mapReady)
				return;
			if(! ME.panelShowed && ! ME.boxShowed && ! ME.spinnerShowed)
				ME.hideMask();
			var emailBttnStyle = "display: none;-webkit-transform: scale(0.1);top: -32px;left: -32px;";
			ME.controller.get("emailButton").setStyle(emailBttnStyle);
			if(ME._f)
			ME.controller.stopListening(
					ME.controller.get("emailButton"),
					Mojo.Event.tap,
					ME._f.bind(ME)
				);
			ME._f = undefined;
		},

	handleRcontentHold: function(evt){
			// 定义有x,y使电邮图标显示到指定位置，定义lat,lon使发送信息为指定的，而不是x,y位置的
			ME.showEmailButton({'x': evt.down.x, 'y': evt.down.y, 'lat': ME.mapLat, 'lon': ME.mapLon});
		},

	popupSetMapType: function(T){
		var items = [
						{label: "街道地图", command: "MAP"},
						{label: "卫星路网地图", command: "HYB"},
						{label: "卫星地图", command: "SAT"},
						{label: "透视地图", command: "PER"}
					];
		var index = 0;
		switch(ME.gblMapType){
			case "MAP":
				index = 0;
				break;
			case "HYB":
				index = 1;
				break;
			case "SAT":
				index = 2;
				break;
			case "PER":
				index = 3;
				break;
			default:
				index = 0;
				break;
			}
		items[index].iconPath = "images/palm-default/popup-item-checkmark.png";
		T.controller.popupSubmenu({
					onChoose: T.HandleChangeMapTypePopupMenuTap.bind(T),
					placeNear: event.target,
					items:items
					});
		},

	HandleChangeMapTypePopupMenuTap: function(cmd){
			ME.setMapType(cmd);
		},

	emailStuff: function(msg, style){
			var head = "<html><head><title>An email from Larry Maps</title>" + 
					"<meta http-equiv='Content-Type' content='text/html; charset=UTF-8' /></head><body><style>";
			var middle = "</style>";
			middle = ".bttmInfo{color:gray;font-size: 10px;text-align: center;}.appName{color:purple;font-size:12px;display: inline;}.appVendor{color:green;font-size:12px;display: inline;}" + middle;
			var tail = "<br><br><div class='bttmInfo'>From <div class='appName'>Larry Maps</div>, by <div class='appVendor'>Choetin Chen</div>, 2012..<a href='mailto:choetin@gmail.com?subject=From.Larry.Maps...'>ASK</a></div></body></html>";

			this.controller.serviceRequest
			(
    			"palm://com.palm.applicationManager",
				{
			        method: 'open',
			        parameters:
					{
			            id: "com.palm.app.email",
			            params:
						{
			                summary: "来自Larry Maps的位置信息...",
			                text: head + style + middle + msg + tail
			            }
			        }
			    }
			); 
		},

	addRedirectHandler: function(){
			this.controller.serviceRequest
			(
				"palm://com.palm.applicationManager",
				{
					method: "addRedirectHandler",
					parameters:
					{
						"appId":"cn.choetin.larry.maps",
						"urlPattern": "^larrymaps://",
						"schemeForm": true
					}
				}
			);
		},

	removeRedirectHandler: function(){
			this.controller.serviceRequest
			(
				"palm://com.palm.applicationManager",
				{
					method: "removeHandlersForAppId",
					parameters:
					{
						"appId":"cn.choetin.larry.maps"
					}
				}
			);
		},
		
	handleCommand: function(evt){
		if (evt.type == Mojo.Event.command){
			switch(evt.command){
				case "go-pref":
					this.controller.stageController.pushScene("pref");
					break;
				case "go-help":
					this.controller.stageController.pushScene("help");
					break;
				case "toggleGPS":
					if(this.searchBarFocused){
							this.blurSearchBar();
						}
					if(! this.apiLoaded){
						this.checkNetwork(this);
						break;
						}
					if(! this.trackMeTimer){
							this.startTracking();
					}else{
							this.stopTracking();
						}
					break;
				case "showSubmenu":
					if(this.searchBarFocused){
							this.blurSearchBar();
						}
					if(! this.apiLoaded){
						this.checkNetwork(this);
						break;
						}
					var items = [
									{label: "切换地图(" + (this.gblMapType? this.gblMapType : "Loading..") + ")", command: "changeMapType", iconPath: "images/palm-default/menu-icon-forward.png"},
									{label: "数据面板", command: "showPanel"},
									{label: "发送中心坐标", command: "sendPosition", iconPath: "images/palm-default/forward.png"},
									{label: "查中心点地理", command: "getCenterLocation", iconPath: "images/palm-default/search-main.png"}
								];
					if(this.panelShowed)
						items[1].iconPath = "images/palm-default/popup-item-checkmark.png";
					this.controller.popupSubmenu({
							onChoose: this.handlePopupMenuTap.bind(this),
							placeNear: event.target,
							items: items
						});	
					break;
				default:
					break;
			    }
		    }
		if (evt.type == Mojo.Event.back){
			if(! ME.mapReady)
				return;
			if(ME._f){
					ME.hideEmailButton();
					evt.stop();
					return;
				}
			if(this.panelShowed){
					ME.showHidePanel("hide");
					evt.stop();
					return;
				}
			if(this.boxShowed){
					ME.closeBox();
					evt.stop();
					return;
				}
			if(this.searchBarFocused){
					ME.blurSearchBar();
					evt.stop();
					return;
				}
			ME.map.closeInfoWindow();
			evt.stop();
		}
	    }
	});
