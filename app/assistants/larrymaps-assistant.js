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
			this.showGpsErrTips = true; // 显示GPS状态提示
			this.inDrag = false; // 处于拖动状态
			this.inGesture = false; // 处于绽放状态
			this.inAdjust = false; // 处于调整偏差状态
			this.inAdjusting = false; // 调整状态中，手指正在移动
			this.gblDraggingEventXY = undefined; // 用于保存拖动的起始坐标的临时变量
			this.panelShowed = false;
			this.boxShowed = false;
			this.spinnerShowed = false;
			// infoWindow是否会自动移到中心点
			this.autoPanning = false;
			this.markers = []; // 存放标志的数组
			this.autoFixOffset = true;
			this.inMeasuring = false; // 正在测距？
			this.inMeasure = false; // 是否可以测距
			this.__tmpSearchKeyword = ""; // 临时保存搜索框关键词，用于完成其它操作后恢复
			this.gblDirectionGhost = {}; // {pointOld: point, pointNew: point, timeout: number}
										 // timeout - 计算两点间的线与垂直线的角度（北方？）
			this.gblDirectionGhost.TIMEOUT = 2;
			this.gblDirectionGhost.timer = 0;
		},

	setup: function(event){
		this.setupSizeStuff();
		this.menuAttr = {omitDefaultItems: true};
		this.menuModel = {
			visible: true,
			items: [
				Mojo.Menu.editItem,
				{label: "调整偏差量", command: "do-adjustment", shortcut: "j", disabled: false},
				{label: "设置", command: "go-pref", shortcut: "s"},
				{label: "帮助", command: "go-help", shortcut: "h"}
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
			hintText : "Search/Command...",
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
				{label : "Menu", command : 'showSubmenu'}
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

		this.controller.setupWidget(
			"panelScroller",
			{mode: 'free'},
			{}
			);
		Mojo.Event.listen(this.controller.document, "keyup", this.handleDocumentKeyUp.bind(this));

		this.controller.listen(
			this.controller.get("rcontent"),
			Mojo.Event.tap,
			this.handleBcontentTap.bind(this)
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

		this.controller.setupWidget(
			"fqsDrawer",
			{
				modelPropert: "closed",
				drawerBottomOffset: 35,
				unstyled: true
			},
			this.fqsDrawerModel = {
				open: false
			}
		);

		// this.controller.document.getElementsByTagName("body")[0].addClassName("palm-dark");
		
		this.controller.listen(
			this.controller.sceneElement,
			Mojo.Event.tap,
			this.quickSearchInBounds.bind(this)
		);
	},
	
	activate: function(event){	
		// 用于检查API状态
		if(this.apiInfoCookie)
			delete this.apiInfoCookie;
		this.apiInfoCookie = new Mojo.Model.Cookie("apiInfoCookie");
		this.apiInfoDATA = this.apiInfoCookie.get();
		
		// 使用最新设定
		if(this.larryCookie)
			delete this.larryCookie;
		this.larryCookie = new larryCookie();
		this.autoFixOffset = this.larryCookie.privateOffset.autoUpdate;
		// 是否可以修改偏移量
		if(this.menuModel.items[1].disabled != this.autoFixOffset){
			this.menuModel.items[1].disabled = this.autoFixOffset;
		}
		// 启动时间日志
		// this.larryCookie.updateTrackingUse();

		if (! this.networkAvailable){
			this.checkNetwork(this);
		} else {
			this.prepareMapAPI(this);
		}
		if(this.mapReady)
			this.updateBottomLine();
		if(! this.updateAGTimer)
			this.updateAGTimer = setInterval(this.dealAutoFixOffsets, 60 * 1000);	// 1分钟自动更新一次偏移量
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
			this.controller.stopListening(this.controller.get("rcontent"), Mojo.Event.tap, this.handleBcontentTap.bind(this))

			this.controller.stopListening(this.controller.get("searchBarGoIcon"), Mojo.Event.tap, this.startToSearch.bind(this));
			this.controller.stopListening(this.controller.get("map"), Mojo.Event.hold, this.handleMapHold.bind(this));
			this.removeInsideEleEvtObsering();
			this.controller.stopListening(this.controller.sceneElement, Mojo.Event.tap, this.quickSearchInBounds.bind(this));
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
			g("larryContainer").style.width = ME.w + "px";
			//g("map").style.height =  (2 * ME.h) + "px";
			//g("map").style.width = (2 * ME.w) + "px";
			g("map").style.height =  ME.h + "px";
			g("map").style.width = ME.w + "px";
			//g("map").style.top =  (0 - (ME.h / 2)) + "px";
			//g("map").style.left = (0 - (ME.w / 2)) + "px";
			g("map").style.top =  "0px";
			g("map").style.left = "0px";
			g("larry").style.maxHeight = (ME.h - 124) + "px";
			var styleSpinnerMask = "height:" + ME.h + "px;width:" + ME.w + "px;";
			g("larrymask").setStyle(styleSpinnerMask);
			g("director").style.top = ((ME.h - 46) / 2) + "px";
			g("director").style.left = ((ME.w - 46) / 2) + "px";
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
					if(cookie.privateOffset.enabled){ // 启动了偏移
						if(ME.inAdjust){ // 处于调整偏移量状态,使用临时偏移量
								ME.mapLat = (parseFloat(poi.point.lat) - parseFloat(ME.tmpOffset.lat)).toFixed(6);
								ME.mapLon = (parseFloat(poi.point.lng) - parseFloat(ME.tmpOffset.lon)).toFixed(6);
							}else{ // 正常状态,用COOKIE偏移量
									ME.mapLat = (parseFloat(poi.point.lat) - parseFloat(cookie.privateOffset.lat)).toFixed(6);
									ME.mapLon = (parseFloat(poi.point.lng) - parseFloat(cookie.privateOffset.lon)).toFixed(6);
								}
					}else{
							ME.mapLat = parseFloat(poi.point.lat).toFixed(6);
							ME.mapLon = parseFloat(poi.point.lon).toFixed(6);
						}
					ME.mapZoomLevel = ME.map.getZoom();
					ME.updateBottomLine();
					ME.mapInfoWindow = ME.map.getInfoWindow();
					ME.autoPanning = true;
					if(ME.mapInfoWindow){
							//ME.emailStuff(html.innerHTML.replace(/[<]/g, "&lt;".replace(/[>]/g, "&gt;")));
							if(! ME.panToInfoWindowTimer){
								ME.panToInfoWindowTimer = setInterval(
									function(){
										ME.mapInfoWindow = ME.map.getInfoWindow();
										if(ME.mapInfoWindow && ME.autoPanning){
											ME.mapGoto(
												{
													'lat':ME.mapInfoWindow.getPosition().lat,
													'lon':ME.mapInfoWindow.getPosition().lng,
													'fromAction': 'tap'
												});
											ME.fixInfoWindow();
											}
										}, 
									2000);
								}
						}
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
				pageCapacity: 4,
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
				pageCapacity: 5,
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

	startToSearch: function(keywordStuff){	// locStuff:
										// {
										//		type: 'localsearch' | 'transitroute',
										//		bound: 'viewport' | 'nearby',
										//		forceLocal: boolean
										// }
		// TODO: 打算做一个全能的搜索框
		try{
		if(! ME.mapReady){
				ME.showBox("地图还没准备好...", "请稍后再试");
				ME.closeBox();
				return;
			}
		ME.blurSearchBar();

		if(ME.inMeasure){
		}
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
				ME.controller.get("panelContent").innerHTML = "<div style='text-align:center;font-size:12px;'>列表为空</div>";
				return;
			}
		if(kw.indexOf(",") == -1 || kw.split(",")[1] == undefined){
				if(! ME.localSearch)
					return;
				if(ME.searchOnce)
					ME.localSearch.clearResults();
				ME.localSearch.search(kw);
				ME.searchOnce = true;
				ME.controller.get("panelContent").innerHTML = "<div style='text-align:center;font-size:12px;'>列表为空</div>";
				return;
			}
		}catch(e){
				ME.showBox("貌似出错了,极有可能是<font color='red'>网络不稳定</font>.<br>实在抱歉..<br>:-(", "请再试一次");
				ME.closeBox(3000);
				ME.stopSpinner();
				ERROR("@@@@ larrymaps#startToSearch Error: " + e);
			}
		},

	quickSearchInBounds: function(evt){
			if(evt.target && evt.target.className == "quickSearchItem"){
				var bounds = new BMap.Bounds(
						ME.map.pixelToPoint(new BMap.Pixel(0, ME.h)),
						ME.map.pixelToPoint(new BMap.Pixel(ME.w, 0))
					);
				ME.startSpinner();
				ME.stopTracking('silent');
				ME.localSearch.searchInBounds(evt.target.innerHTML.trim(), bounds);
			}
		},

	fixInfoWindow: function(){
			try{
			var fixIt = function(){
					ME.controller.window.document.getElementsByClassName("BMap_top")[0].style.borderTop = "1px solid #ABABAB";
					ME.controller.window.document.getElementsByClassName("BMap_top")[0].style.backgroundColor = "#FFFFFF";
					ME.controller.window.document.getElementsByClassName("BMap_center")[0].style.backgroundColor = "#FFFFFF";
					ME.controller.window.document.getElementsByClassName("BMap_center")[0].style.borderLeft = "1px solid #ABABAB";
					ME.controller.window.document.getElementsByClassName("BMap_center")[0].style.borderRight = "1px solid #ABABAB";
					ME.controller.window.document.getElementsByClassName("BMap_bottom")[0].style.backgroundColor = "#FFFFFF";
					ME.controller.window.document.getElementsByClassName("BMap_bottom")[0].style.borderBottom = "1px solid #ABABAB";
				};
			var checkIt = function(){
					if(ME.controller.window.document.getElementsByClassName("BMap_pop")[0] && ME.controller.window.document.getElementsByClassName("BMap_pop")[0].style.visibility != "hidden"){
							fixIt();
							clearInterval(checkItTimer);
							checkItTimer = undefined;
						}
				};
			var checkItTimer = setInterval(checkIt, 50);
			}catch(e){
					ERROR("@@@@@ larrymaps#fixInfoWindow got ERRORs: " + e);
				}
		},

	// 查询某点的地理描述。提供一个回调函数: 参数为地理描述的字串。
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
								ME.markers[1] = ME.placeMarker({'point': ME.map.getCenter(), 'index': 1});
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
			ME.showHidePanel("show");
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
			ME.showHidePanel("show");
			ERROR("@@@@@transit result:" + result);
		},

	startSpinner: function(){
			ME.spinnerShowed = true;
			if(! ME.larryCookie)
				ME.larryCookie = new larryCookie();
			var h = parseInt(ME.larryCookie.devInfo.winHeight);
			var w = parseInt(ME.larryCookie.devInfo.winWidth);
			var styleSpinner = "display:block;top:" + ((h - 280) / 2) + "px;left:" + ((w - 128) / 2) + "px;";
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
				T.showBox("即将打开地图,请稍等...", "很快了");
				T.closeBox(2200);
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
			var fff = function(val){
				if(val == "download"){
					var DL = new APIUpdater();
					T.startSpinner();
					if(T.chkApiTimer){
							clearInterval(T.chkApiTimer);
							T.chkApiTimer = undefined;
						}
					// 这个定时器用于更新与API相关的提示内容
					T.chkApiTimer = setInterval(function(){
						ME.updateBottomLine("正在<br>下载API<br>...");
						api = (new Mojo.Model.Cookie("apiInfoCookie")).get();
						if(api){
							if(api.cssReady == true){
								ME.showBox("Map API css 已就绪<br>若长时间停留于此,<br>几乎都是因为不同的网络条件造成,<br>请重启此程序...", "正在继续..." + ME.getDateTime());
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
										ME.showBox("正在加载API!<br>若长时间停留于此,<br>请到'设置'页面的程序程序更新API.", "等待中..." + ME.getDateTime());
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
				};
			Mojo.Controller.stageController.activeScene().showAlertDialog({
				onChoose: fff,
				preventCancel: false,
				allowHTMLMessage: true,
				title: "Larry Maps需要更新API",
				message: $L("首次运行Larry Maps或者上次更新API不成功, 均需要下载API文件才能正确运行, " +
					"<br>提示下载完成后，将<font color='green'>自动打开地图</font>. " +
					"<br>如果以后发现地图不能正常使用, 可以从<font color='green'>菜单</font>进入<font color='green'>设置</font>页面进行<font color='red'>手动更新API</font>." +
					"<hr><a href='www.webosnation.com/filemgr-service'>" +
					"<div style='text-align: right;font-size:10px;color:red;line-height:12px;'>需要FileMgr服务!</div></a>"
					),
				choices: [{label: $L("开始下载"), value: "download", type: "affirmative"},{label: $L("稍后再试"), value: "NOP", type: "negative"}]
			});
		}
	},
	
	checkNetwork: function(T){
		// 抓取搜索框内的文本输入框事件
		ME.captureInsideEleEvt();

		T.updateBottomLine("正在等待<br>网络连接<br>...");
		// closeBox默认是1300毫秒关闭的
		setTimeout(T.startSpinner, 1400);
		var R = T.controller.serviceRequest(
			"palm://com.palm.connectionmanager",
			{
			method: "getstatus",
			parameters: {subscribe: true},
			onSuccess: function(evt){
					if(evt.isInternetConnectionAvailable){
						T.stopSpinner();
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
			g("larry").setStyle("display: block; opacity: 0.8;");
			ME.showMask();
			g("content").innerHTML = content;
			g("plnTxt").innerHTML = bttnText;
			if(ME.__closeBoxTimer)
					clearTimeout(ME.__closeBoxTimer);
			if(ME.__resetBoxTimer)
				clearTimeout(ME.__resetBoxTimer);
		},

	closeBox: function(t){
			var timeout = 1700;
			if(typeof(t) == "number" && t >= 500){
					timeout = parseInt(t);
				}
			var hideBox = function(){
					ME.controller.get("larry").setStyle("opacity: 0;");
					ME.boxShowed = false;
					ME.controller.get("larry").setStyle("display: none;");
					if(! ME.panelShowed && ! ME.spinnerShowed){
							ME.hideMask();
						}
					ME.__closeBoxTimer = undefined;
				};
			ME.__closeBoxTimer = setTimeout(hideBox, timeout);
			var resetBox = function(){
					var g = ME.controller.get;
					g("content").innerHTML = "Larry Maps正在为你运行";
					g("plnTxt").innerHTML = ";-)";
					g("larry").setStyle("display: none; opacity: 0.5;");
					g("larrymask").setStyle("display: none; opacity: 0.3;");
					ME.__resetBoxTimer = undefined;
				};
			ME.__resetBoxTimer = setTimeout(setTimeout, timeout + 500);
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
			if(typeof(BMap) == undefined){
					setTimeout(function(){T.createMapNode;}, 3000);
					T.showBox("似乎API未被部署,<br>如果真是如此,我想你可以到设置页面，在程序菜单中更新一下API.<br>如果更新成功也也不能使用,我想必定是万恶的API提供者在搞鬼.", "告急!!!");
				}
			T.closeBox(1500);
			var fadeInI = 0;
			T.controller.get("map").style.opacity = 0;
			T.controller.get("map").style.display = "block";
			var fadeInFunc = function(){
					T.controller.get("map").style.opacity = fadeInI/10;
					fadeInI += 1;
					if(fadeInI == 10){
							clearInterval(fadeInTimer);
							fadeInTimer = undefined;
						}
				};
			var fadeInTimer = setInterval(fadeInFunc, 100);

			// 设定地图类型
			var mapTypeRead = T.larryCookie.lastViewMapType;
			ME.gblMapType = mapTypeRead;
			var mapType;
			switch(mapTypeRead){
				case "MAP":
					mapType = BMAP_NORMAL_MAP;
					ME.controller.get("rcontent").setStyle("color: purple");
					break;
				case "SAT":
					mapType = BMAP_SATELLITE_MAP;
					ME.controller.get("rcontent").setStyle("color: purple");
					break;
				case "PER":
					ME.controller.get("rcontent").setStyle("color: purple");
					mapType = BMAP_PERSPECTIVE_MAP;
					break;
				case "HYB":
					mapType = BMAP_HYBRID_MAP;
					ME.controller.get("rcontent").setStyle("color: purple");
					break;
				default:
					mapType = BMAP_NORMAL_MAP;
					ME.controller.get("rcontent").setStyle("color: purple");
					break;
				}
			T.map = new BMap.Map("map", {enableHighResolution: true});
			if(mapType == BMAP_PERSPECTIVE_MAP){
					// 透视地图，暂时不设定地图类型。
					// 设定地图类型，就在设定城市之后进行。
					var _per_f = function(v){
							var city = v.addressComponents.city;
							T.showBox("透视地图仅支持少数城市,<br>如: 北京，上海，广州等...<br>其它城市可能会使地图空白.", "透视地图加载时间稍长...");
							T.closeBox(7000);
							T.map.setCurrentCity(city);
							T.map.setMapType(mapType);
							T.map.centerAndZoom(point, T.mapZoomLevel);
						}
				}else{
						T.map.setMapType(mapType);
					}
			T.minZoom = mapType.getMinZoom();
			T.maxZoom = mapType.getMaxZoom();
			if(T.mapZoomLevel < T.minZoom || T.mapZoomLevel > T.maxZoom)
				T.mapZoomLevel = 16;

			if(T.updateMapPoint()){
					var point;
					if(ME._LaunchedWithParams){ // 是带参数启动的
						point = ME.calcPoint(ME._LaunchedWithParams._lat, ME._LaunchedWithParams._lon, ME._LaunchedWithParams._oslat, ME._LaunchedWithParams._oslon, ME._LaunchedWithParams._offsetON);
					}else{ // 不带参数启动
						if(! ME.larryCookie)
							ME.larryCookie = new larryCookie();
						if(ME.larryCookie.privateOffset.enabled){
							// 这是启动时执行的,不存在inAdjust的情况
							point = ME.calcPoint(T.mapLat, T.mapLon, T.larryCookie.privateOffset.lat, T.larryCookie.privateOffset.lon);
							}else{
									point = new BMap.Point(T.mapLon, T.mapLat);
								}
						}
					T.setupSearchStuff();
					// 最后决定初始化地图
					// 除透视类型地图外，其它地图类型可以直接centerAndZoom。
					if(_per_f){
							T.getLocationFromPoint(point, _per_f);
							T.showBox("正在获取当前地点的城市名...<br>[透视地图需要指定一个城市]", "请稍候...");
						}else{
								T.map.centerAndZoom(point, T.mapZoomLevel);
								T.setMapType(T.gblMapType);
							}
					// 无论哪种地图类型，我们都把参数的坐标标记到地图上
					if(ME.params && ME.params.target){
						ME.placeMarker({point: point, 
										index: 3,
										img: {
												url: "images/tine.png",
												size: {width: 25, height: 32},
												anchor: {width: 4, height: 32}
											}
										});
						}
				}else{
					// 什么都不定义，显示到一个特定的位置 
					T.map.centerAndZoom(new BMap.Point(110.285375, 25.213604), 5);
				}
			ME.updateBottomLine();
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
			T.listenGestureEvents();
			// 用于拖拽地图
			T.listenDragEvents();
			// 按住以选择发送位置
			T.controller.listen(
				T.controller.get("rcontent"),
				Mojo.Event.hold,
				T.handleBcontentHold.bind(T)
				);
	
			T.blurSearchBar();
			setTimeout(
					function(){
							// 是时候不停转了，不逗你了
							// 显然，我们可以监听ME.map的load事件来决定这个转圈什么时候停
							ME.stopSpinner();
						},
					2000
				);
		var f = function(v){
				if(v != 0.00)
					ME.controller.get("searchBar").mojo.setValue("路线长度: " + v + " 米");
				else
					ME.controller.get("searchBar").mojo.setValue("请点击地图开始测距(后退手势退出)!");
			};
		if(! ME.__distUtil)
			ME.__distUtil = new distanceUtil(ME.map, f);
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
						ME.mapLat = parseFloat(ME.larryCookie.lastViewPoint.lat);
						ME.mapLon = parseFloat(ME.larryCookie.lastViewPoint.lon);
						// 如果带参数运行，打开从参数中获取的坐标位置
						if(ME.params && ME.params.target){
							// 检测格式是否符合,不知道是不是很有必要
							// 这个正则好像会很复杂
							// N 为N位的整数, S为字符串
							// larrymaps://lat=N[.N]&lon=N[.N]&z=N&t=S&oslat=N[.N]&oslon=N[.N]
							var tmpVar = ME.params.target;
							var statOK = true;
							tmpVar = tmpVar.toLowerCase();
							//if(/^larrymaps:\/\//.test(tmpVar){
							if(tmpVar.indexOf("larrymaps://") == 0 && tmpVar.indexOf("lat=") && tmpVar.indexOf("lon=") && tmpVar.indexOf("z=") && tmpVar.indexOf("&")){
									tmpVar = tmpVar.replace("larrymaps://", "");
									tmpVar = tmpVar.split("&");
									for(var i=0; i<tmpVar.length; i++){
											if(tmpVar[i].indexOf("lat") == 0)
												{var _lat = parseFloat(tmpVar[i].split("=")[1]);}
											if(tmpVar[i].indexOf("lon") == 0)
												{var _lon = parseFloat(tmpVar[i].split("=")[1]);}
											if(tmpVar[i].indexOf("z") == 0)
												{var _level = parseInt(tmpVar[i].split("=")[1]);}
											if(tmpVar[i].indexOf("t") == 0)
												{var _type = tmpVar[i].split("=")[1];}
											if(tmpVar[i].indexOf("oslat") == 0)
												{var _oslat = parseFloat(tmpVar[i].split("=")[1]);}
											if(tmpVar[i].indexOf("oslon") == 0)
												{var _oslon = parseFloat(tmpVar[i].split("=")[1]);}
											if(tmpVar[i].indexOf("offseton") == 0)
												{var _offsetON = tmpVar[i].split("=")[1];}
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
									ME._LaunchedWithParams = {"_lat": _lat, "_lon": _lon, "_oslat": _oslat, "_oslon": _oslon, "_level": _level, '_offsetON': _offsetON};
									// 如果有偏移量提供，提示用户是否保存所提供的偏移量
									if(_oslat && _oslon && (parseFloat(_oslat) != ME.larryCookie.privateOffset.lat || parseFloat(_oslon) != ME.larryCookie.privateOffset.lon)){
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
			//var point = ME.map.pixelToPoint(new BMap.Pixel(evt.down.x + (ME.w/2), evt.down.y + (ME.h/2)));
			if(! ME.searchBarFocused){
				if(ME.inDrag || ME.inGesture){
					return;
				}else{
					if(ME.inMeasure){
						if(! ME.inMeasuring){
							ME.inMeasuring = true;
						}
						ME.__distUtil.addPoint(ME.map.pixelToPoint(new BMap.Pixel(evt.down.x, evt.down.y)));
						return;
					}
				// test the direction controller:
				// ME.updateDirection(ME.map.getCenter(), ME.map.pixelToPoint(new BMap.Pixel(evt.down.x, evt.down.y)));
				}
			}else{
					ME.blurSearchBar();
				}
		},
	
	handleMapHold: function(evt){
			if(! ME.searchBarFocused){
				if(ME.inDrag || ME.inGesture || ME.inMeasure)
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
			if(! ME.larryCookie)
				ME.larryCookie = new larryCookie();
			var v = evt.value;
			// 定义一些快捷方式 - Most likely "Just type".
			if(v.indexOf(".") == 0 || v.indexOf("Go ") == 0){
				ME.controller.get("searchBarGoIcon").removeClassName("search");
				ME.controller.get("searchBarGoIcon").addClassName("command");	
			} else {
				ME.controller.get("searchBarGoIcon").removeClassName("command");
				ME.controller.get("searchBarGoIcon").addClassName("search");
			}
			if(v == "Go " || v == "go "){
				ME.controller.get("searchBar").mojo.setText("Go ");
			}
			if(v == "Go 0")
				ME.controller.get("searchBar").mojo.setText("Go 0,0,");
			if(v.indexOf("Go ") ==  0 && v.indexOf(",") > 3){
					v = v.split(" ");
					v = v[1];
					v = v.split(",");
					_lat = v[0] ? parseFloat(v[0]) : undefined;
					_lon = v[1] ? parseFloat(v[1]) : undefined;
					_z = v[2] ? parseInt(v[2]) : undefined;
					if(_lat && _lon){
						ME.stopTracking();
						var point = new BMap.Point(
							_lon + parseFloat(ME.larryCookie.privateOffset.lon), 
							_lat + parseFloat(ME.larryCookie.privateOffset.lat)
							);
						ME.markers[4] = ME.placeMarker({point: point, 
								index: 4,
								img: {
									url: "images/tine.png",
									size: {width: 25, height: 32},
									anchor: {width: 4, height: 32}
								}
							});
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
					this.closeBox();
					return;
				}
			if(v == ".unregister"){
					this.removeRedirectHandler();
					return;
				}
			if(v.indexOf(".unit") == 0){
					if(v.replace(/^\.unit\ /, "").trim() == "mps"){
						this.showBox("速度单位改为: 米/秒!", "完成");
						ME.larryCookie.setSpeedUnit("mps");
						this.closeBox();
						return;
					}
					if(v.replace(/^\.unit\ /, "").trim() == "kmph"){
						ME.larryCookie.setSpeedUnit("kmph");
						this.showBox("速度单位改为: 公里/小时!", "完成");
						this.closeBox();
						return;
					}
				}
			if(v == ".refreshOffsets"){
					this.autoUpdateBaiduMapGeoOffsets({from: 0, to: 4, lat: this.mapLat, lon: this.mapLon});
					return;
				}
			if(v.indexOf(".setDirectionTimeout") == 0){
				if(v.split(" ")[1] && v.split(" ")[1].match(/\d+/)){
					ME.gblDirectionGhost.TIMEOUT = parseInt(v.split(" ")[1]);
					ME.gblDirectionGhost.timer = 0;
				}
			}
		},

	calcPoint: function(lat, lon, oslat, oslon, offsetON){
			if(!(lat && lon))
				return null;
			if((! offsetON || offsetON == "true") && oslat != undefined && oslon != undefined){
				var _lat = (parseFloat(lat) + parseFloat(oslat)).toFixed(6);
				var _lon = (parseFloat(lon) + parseFloat(oslon)).toFixed(6);
			} else {
					var _lat = lat;
					var _lon = lon;
				}
			return (new BMap.Point(_lon, _lat));
		},

	// 改变坐标 | 改变放大级别 | 摆放GPS定位标志
	mapGoto: function(obj){	
			try{
			if(! ME.mapReady){
					ME.showBox("地图未曾就绪...", "没有动作被执行");
					return;
				}
			// 确保每次都使用最新的COOKIE。
			if(ME.larryCookie)
				delete ME.larryCookie;
			ME.larryCookie = new larryCookie();

			var point = undefined;
			if(obj.lat && obj.lon){ // 是否改变坐标
				// 显然，点击进行移动地图或者拖动地图时，是不能用偏移量的，但需要更新全局坐标变量
				if(obj.fromAction != "tap" && obj.fromAction != "drag"){ 
						// 这不是点击地图
						// ME._LaunchedWithParams 存在，则使用其保存的偏移量(仅用于打开地图时的标志)
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
						if(ME.larryCookie.privateOffset.enabled){ // 是否使用偏移量
								if(ME.inAdjust){ // 若处于调整偏移量状态，则使用临时偏移量
										point = ME.calcPoint(obj.lat, obj.lon, ME.tmpOffset.lat, ME.tmpOffset.lon);
									}else{
											// 正常状态, 使用COOKIE偏移量
											point = ME.calcPoint(obj.lat, obj.lon, ME.larryCookie.privateOffset.lat, ME.larryCookie.privateOffset.lon);
										}
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
									ME.mapLat = parseFloat(obj.lat).toFixed(6);
									ME.mapLon = parseFloat(obj.lon).toFixed(6);
									}
						}
				}else{ // 不是改变坐标的
						point = ME.map.getCenter();
					}
				if(point){
						// 移动地图, 如果处于调整偏差状态，禁用动画
						var panOpt = {};
						if(ME.inAdjust)
							panOpt.noAnimation = true;
						ME.map.panTo(point, panOpt);
						// 我们是否处于GPS定位，是则放一个标志在地图上
						if(ME.trackMeTimer && obj.fromAction == "gps"){
								ME.placeGpsMarker(point);
							}
					}
			if(obj.zoom && obj.zoom != ME.mapZoomLevel && obj.zoom >= ME.minZoom && obj.zoom <= ME.maxZoom){
					// 如果不是从缩放手势来到这儿,我们显示一个缩放的动画效果
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
				var speed = (ME.speed * 3.6).toFixed(1) + "km/h";
			}else{ // 其它情况用m/s, COOKIE值应为 'mps'
					var speed = parseFloat(ME.speed).toFixed(2) + "m/s";
				}

			// 更新左上角的信息盒，更新COOKIE内的坐标信息
			ME.updateBottomLine(parseFloat(ME.mapLat).toFixed(6) + "<br>" + parseFloat(ME.mapLon).toFixed(6) + "<br>[" + parseInt(zoom) + "] " + speed);
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
					// 计算两点的距离，目前处理的两点是介于1秒的变化量，显然，这个是实时的速度！
					// 这里可以设置一些全局变量，保存在N秒内坐标变化量，这样可以计算出N秒内的平均速度.
					var fP = new BMap.Point(rtnValue.old.lon, rtnValue.old.lat);
					var sP = new BMap.Point(rtnValue.gps.lon, rtnValue.gps.lat);
					var tSpeed = ME.map.getDistance(fP, sP);
					if(ME.gblDirectionGhost.timer == 0){
						ME.gblDirectionGhost.pointOld = fP;
						ME.gblDirectionGhost.timer ++;
					} else if(ME.gblDirectionGhost.timer == ME.gblDirectionGhost.TIMEOUT){
						ME.gblDirectionGhost.pointNew = sP;
						ME.updateDirection(ME.gblDirectionGhost.pointOld, ME.gblDirectionGhost.pointNew);
						ME.gblDirectionGhost.timer = 0;
					} else {
						ME.gblDirectionGhost.timer ++;
					}
					if(typeof(tSpeed) != "number")
						tSpeed = 0.0;
					ME.speed = tSpeed.toFixed(1);
					if(ME.speed > 900){
							// 这个速度很吓人,但GPS返回的数据就是会导致这种情况发生
							ME.speed = 0.0;
						}
					// GPS返回有效数值，按钮变绿色
					ME.cmdMenuModel.items[0].iconPath = "images/GPS-on.png";
					ME.controller.modelChanged(ME.cmdMenuModel);
					if(ME.inAdjusting == false)
						ME.mapGoto({'lat': rtnValue.gps.lat, 'lon': rtnValue.gps.lon, 'fromAction': 'gps'});
					// 定位成功后，GPS有状态改变的话，需要显示，所以再次启用提示
					if(! ME.showGpsErrTips){
							ME.showGpsErrTips = true;
							if(ME.controller.get("content").innerHTML.match("初始化GPS")){
									ME.closeBox(500);
								}
						}
					delete fP;
					delete sP;
				}else if(ME.showGpsErrTips){
						// 我们只提示一次，时长5秒
						ME.showGpsErrTips = false;
						if(rtnValue.gps.errorText == ""){;
							ME.showBox("正在初始化GPS,<br>如果是开机后初次使用GPS,<br>可能需要几分钟!!!<br>[GPS定位需要在室外使用]", "按钮变为<font color='green'>绿色</font>时定位成功");
							ME.closeBox(5000);
						}else{
								// GPS错误，包括禁止程序使用GPS等情况
								ME.cmdMenuModel.items[0].iconPath = "images/GPS-error.png";
								ME.controller.modelChanged(ME.cmdMenuModel);
								ME.showBox("使用GPS出错:<br>"+rtnValue.gps.errorText, timeS);
							}
					}
		},

	placeGpsMarker: function(point, imgObj){
			if(! (point instanceof BMap.Point))
				return;
			ME.map.removeOverlay(this.gpsMarker);
			// 是否处于调整偏差状态？
			// 是的话，改变GPS标志为一个有箭头的标志.
			if(! this.inAdjust){
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
			}else{ 
					// 这是一个有箭头的GPS标志
					var adjIcon = new BMap.Icon("images/adjust-cross.png",
							new BMap.Size(46, 46),
							{anchor: new BMap.Size(23, 23)}
						);
					this.gpsMarker = new BMap.Marker(
							point,
							{icon: adjIcon}
						);
					this.gpsMarker.setZIndex(800);
				}
			ME.map.addOverlay(this.gpsMarker);
			var callback = function(v){
					var addr = v.addressComponents.province + v.addressComponents.city + v.addressComponents.district + v.addressComponents.street + v.addressComponents.streetNumber;
					ME._gpsInfoWin = new BMap.InfoWindow(
							"<div style='font-size:14px;color:purple;'>纬度lat: "+ ME.mapLat+ 
							"<br>经度lon: " + ME.mapLon + 
							"<br>地址: " + addr + "<div>", 
							{
								title: "<font style='font-size:16px;'>GPS坐标信息</font>",
								width: 120, 
								height: 0
							}
												);
					ME.gpsMarker.openInfoWindow(ME._gpsInfoWin);
					ME.fixInfoWindow();
					ME.stopSpinner();
				};
			var ow = function(){
					ME.stopTracking();
					ME.getLocationFromPoint(point, callback);
				};
			this.gpsMarker.removeEventListener("click", ow);
			this.gpsMarker.addEventListener("click", ow);
		},

	placeMarker: function(param){ 	// param: 
									// {
									// 		point: point,  
									// 		index: index,
									// 		lat_lon: {lat: lat, lon: lon},
									// 		img: 
									// 			{
									// 				url: url,
									// 				size: 
									// 					{width: width, height: height}, 
									// 				anchor: 
									// 					{width: width, height: height},
									// 				offset:
									// 					{width: left, height: top}
									// 			}
									// }
									//
									// return: An instance of BMap.Marker
			if(! param)
				return null;
			if(ME.markers[param.index]){
					ME.map.removeOverlay(ME.markers[param.index]);
					ME.markers[param.index] = undefined;
				}
			var poi = param.point ? param.point : new BMap.Point(param.lat_lon.lon, param.lat_lon.lat);
														// param.point | 
														// BMap.Point(param.lat_lon.lon, param.lat_lon.lat)
			if(! poi)
				return null;
			if(param.img && param.img.size){
				var iconSize = new BMap.Size(param.img.size.width, param.img.size.height);
				var infoWinAnchor = new BMap.Size(param.img.size.width/2, 0);
			}else{
					var iconSize = new BMap.Size(24, 24); // param.img.size.width, param.img.size.height
				}

			if(param.img && param.img.anchor)
				var iconAnchor = new BMap.Size(param.img.anchor.width, param.img.anchor.height);
			else
				var iconAnchor = new BMap.Size(12, 12); // param.img.anchor.width, param.img.anchor.height

			if(param.img && param.img.url)
				var url = param.img.url;
			else
				var url = "images/palm-default/star-on.png"; // param.img.url

			var icon = new BMap.Icon(
					url,
					iconSize,
					{
						anchor: iconAnchor,
						infoWindowAnchor: infoWinAnchor
					}
				);
			ME.markers[param.index] = new BMap.Marker(
					poi,
					{
						icon: icon
					}
				);
			ME.map.addOverlay(this.markers[param.index]);
			var callback = function(v){
					var cookie = new larryCookie();
					var addr = v.addressComponents.province + v.addressComponents.city + v.addressComponents.district + v.addressComponents.street + v.addressComponents.streetNumber;
					var markerInfoWin = new BMap.InfoWindow(
							"<div style='font-size:14px;color:purple;'>纬度lat: "+ ME.mapLat+ 
							"<br>经度lon: " + ME.mapLon + 
							"<br>偏移量(lat/lon):" + cookie.privateOffset.lat + "/" + cookie.privateOffset.lon +
							"<br><font color='green'>地址: " + addr + "</font><div>", 
							{
								title: "<font style='font-size:16px;'>GPS坐标信息</font>",
								width: 120, 
								height: 0
							}
												);
					ME.markers[param.index].openInfoWindow(markerInfoWin);
					ME.markers[param.index].addr = v;
					ME.fixInfoWindow();
					ME.stopSpinner();
					delete cookie;
				};
			var ow = function(){
					ME.stopTracking();
					if(ME.markers[param.index].addr == undefined){
						ME.getLocationFromPoint(param.point, callback);
					} else {
							callback(ME.markers[param.index].addr);
						}
				};
			ME.markers[param.index].removeEventListener("click", ow);
			ME.markers[param.index].addEventListener("click", ow);
			return ME.markers[param.index];
		},
	
	startTracking: function(interval){
			if(this.trackMeTimer)
				return;
			if(interval && interval > 1000){
				this.trackMeTimer = setInterval(this._trackMe, interval);
			}else{
				this.trackMeTimer = setInterval(this._trackMe, 1000);
			}
			// 启用GPS，按钮变为橙色，意为等待中
			this.cmdMenuModel.items[0].iconPath = "images/GPS-wait.png";
			this.controller.modelChanged(this.cmdMenuModel);
		},

	stopTracking: function(opts){
			if(! this.trackMeTimer)
				return;
			clearInterval(this.trackMeTimer);
			this.trackMeTimer = undefined;
			var dStyle = "display: none;-webkit-transform: rotate(0deg);";
			ME.controller.get("director").setStyle(dStyle);
			ME.GPS.stop();
			// GPS停止，按钮变为灰色
			this.cmdMenuModel.items[0].iconPath = "images/GPS-off.png";
			this.controller.modelChanged(this.cmdMenuModel);
			// 恢复启用提示
			this.showGpsErrTips = true;
			this.speed = 0;
			if(opts && opts == "silent")
				return;
			this.showBox("貌似你已经停止使用GPS定位!!!!","好吧,信不信由你,反正我是信了");
			this.closeBox(1000);
		},

	setMapType: function(mapType){
			if(typeof(mapType) != "string")
				return;
			else
				mapType = mapType.toUpperCase();
			ME.startSpinner();
			ME.gblMapType = mapType;
			if(!  ME.larryCookie)
				ME.larryCookie = new larryCookie();
			var msg;
			var baidu_MAP_TYPE;
			switch(mapType){
				case "MAP":
					baidu_MAP_TYPE = BMAP_NORMAL_MAP;
					ME.controller.get("rcontent").setStyle("color: purple");
					msg = "普通街道";
					break;
				case "PER":
					ME.controller.get("rcontent").setStyle("color: purple");
					baidu_MAP_TYPE = BMAP_PERSPECTIVE_MAP;
					// 即将用到这个函数
					var per_f = function(v){
							ME.map.setCurrentCity(v.addressComponents.city);
							ME.map.setMapType(baidu_MAP_TYPE);
							ME.showBox("透视地图仅支持少数城市,<br>如: 北京，上海，广州等...<br>其它城市可能会使地图空白.", "透视地图加载时间稍长...");
							var delayClosing = function(){
									ME.closeBox();
									ME.stopSpinner();
								};
							setTimeout(delayClosing, 7000);
						}
					msg = "透视类型";
					break;
				case "SAT":
					baidu_MAP_TYPE = BMAP_SATELLITE_MAP;
					ME.controller.get("rcontent").setStyle("color: purple");
					msg = "卫星";
					break;
				case "HYB":
					baidu_MAP_TYPE = BMAP_HYBRID_MAP;
					ME.controller.get("rcontent").setStyle("color: purple");
					msg = "卫星路网";
					break;
				default:
					baidu_MAP_TYPE = BMAP_NORMAL_MAP;
					ME.controller.get("rcontent").setStyle("color: purple");
					msg = "普通街道";
					break;
				}
;
			
			if(baidu_MAP_TYPE != BMAP_PERSPECTIVE_MAP){
					ME.map.setMapType(baidu_MAP_TYPE);
					msg = "进入" + msg + "地图模式";
				}else{
						if(per_f){
								ME.getLocationFromPoint(ME.map.getCenter(), per_f);
								msg = "你选择了" + msg + "地图模式,<br>" + "正在获取当前城市名...";
							}else{
									msg = "切换透视地图出错!<br>per_f 函数未定义...";
								}
					}
			ME.showBox(msg, "请稍候...");
			ME.minZoom = baidu_MAP_TYPE.getMinZoom();
			ME.maxZoom = baidu_MAP_TYPE.getMaxZoom();
			if(ME.mapZoomLevel < ME.minZoom || ME.mapZoomLevel > ME.maxZoom){
					ME.mapZoomLevel = 16;
					ME.map.setZoom(ME.mapZoomLevel);
				}
			// 保存地图类型，下次启动地图时使用
			ME.larryCookie.updateLastViewMapType(mapType);
			ME.larryCookie.updateLastViewPoint({lat: ME.mapLat, lon: ME.mapLon, level: ME.mapZoomLevel});
			ME.updateBottomLine();
			if(baidu_MAP_TYPE != BMAP_PERSPECTIVE_MAP){
					var hide_f = function(){
							ME.closeBox();
							ME.stopSpinner();
						}
					setTimeout(hide_f, 2000);
				}
		},

	blurSearchBar: function(){
			var sb = ME.controller.get("searchBar");
			var sbi = ME.controller.get("searchBarGoIcon");
			sb.mojo.blur();
			sb.removeClassName("focus");
			sb.addClassName("blur");
			sbi.removeClassName("command");
			sbi.removeClassName("search");
			sbi.addClassName("graydown");
			ME.searchBarFocused = false;
			if(ME.fqsDrawerModel.open){
				var opacityOfQSC = 10;
				var f = function(){
						if(opacityOfQSC == 0){
							if(_timer){
								clearInterval(_timer);
								_timer = undefined;
							}
						}
						ME.controller.get("quickSearchDrawerContainer").style.opacity = opacityOfQSC / 10;
						opacityOfQSC--;
					};
				var _timer = setInterval(f, 80);
				ME.controller.get("fqsDrawer").mojo.toggleState();
			}
		},

	focusSearchBar: function(){
			var sb = ME.controller.get("searchBar");
			var sbi = ME.controller.get("searchBarGoIcon");
			sbi.removeClassName("graydown");
			if(sb.mojo.getValue().indexOf(".") == 0 || sb.mojo.getValue().indexOf("Go") == 0){
				sbi.removeClassName("search");
				sbi.addClassName("command");	
			} else {
				sbi.removeClassName("command");
				sbi.addClassName("search");
			}
			sb.removeClassName("blur");
			sb.addClassName("focus");
			ME.searchBarFocused = true;
			if(ME.mapReady && ME.controller.get("searchBar").mojo.getValue() == '' && ! ME.fqsDrawerModel.open){
				var opacityOfQSC = 0;
				var f = function(){
						if(opacityOfQSC == 10){
							if(_timer){
								clearInterval(_timer);
								_timer = undefined;
							}
						}
						ME.controller.get("quickSearchDrawerContainer").style.opacity = opacityOfQSC / 10;
						opacityOfQSC++;
					};
				var _timer = setInterval(f, 20);
				ME.controller.get("fqsDrawer").mojo.toggleState();
			}
		},

	updateBottomLine: function(content){
			var strHTML;
			if(! ME.larryCookie)
				ME.larryCookie = new larryCookie();
			if(ME.larryCookie.speedUnit == "kmph"){
				var speed = (ME.speed * 3.6).toFixed(1) + "km/h";
			}else{ // 其它情况用m/s, COOKIE值应为 'mps'
					var speed = parseFloat(ME.speed).toFixed(2) + "m/s";
				}
			if(! content)
				strHTML = parseFloat(ME.mapLat).toFixed(6) + "<br>" + parseFloat(ME.mapLon).toFixed(6) + "<br>[" + ME.mapZoomLevel + "] " + speed;
			else
				strHTML = content + "";
			strHTML = strHTML.replace(/[<]br[>]/g, ",");
			ME.controller.get("rcontent").innerHTML = strHTML;
		},

	handleDocumentKeyUp:function(evt){
			if(Mojo.Char.isEnterKey(evt.keyCode)){
					ME.startToSearch();
				}else if(! ME.searchBarFocused){
						var generateURLobj = function(maptype){
								var pm = pm || {};
								pm.staticMapURL = "http://maps.googleapis.com/maps/api/staticmap?" + 
									"center=" + ME.mapLat + "," + ME.mapLon +
									"&zoom=" + ((ME.mapZoomLevel-1)>0 ? (ME.mapZoomLevel-1) : 1) +
									"&size=" + ME.w + "x" + ME.h +
									"&language=zn_CN" +
									"&sensor=false" +
									"&markers=color:green|label:X|" + ME.mapLat + "," + ME.mapLon +
									"&maptype=" + maptype;
								pm.winHeight = ME.h;
								pm.winWidth = ME.w;
								return pm;
							};
						if(evt.keyCode == Mojo.Char.h){
								ME.viewGoogleStaticMap(generateURLobj("hybrid"));
								return;
							}
						if(evt.keyCode == Mojo.Char.t){
								ME.viewGoogleStaticMap(generateURLobj("terrain"));
								return;
							}
						if(evt.keyCode == Mojo.Char.q){ // 按键'q'放大一级
								ME.mapGoto({'zoom': ME.mapZoomLevel + 1});
								return;
							}
						if(evt.keyCode == Mojo.Char.e){ // 按键'e'缩小一级
								ME.mapGoto({'zoom': ME.mapZoomLevel - 1});
								return;
							}
						if(evt.keyCode == Mojo.Char.s || evt.keyCode == Mojo.Char.w || evt.keyCode == Mojo.Char.a || evt.keyCode == Mojo.Char.d){
								ME.stopTracking('silent');
								var panning_var;
								panning_var = 0.0005 * Math.pow(2, (ME.maxZoom - ME.mapZoomLevel));
								// 按键'w','s','a','d'分别对应地图的上移，下移，左移，右移
								if(evt.keyCode == Mojo.Char.s){
										ME.mapLat = (parseFloat(ME.mapLat) - panning_var).toFixed(6);
										ME.mapGoto({'lat': ME.mapLat, 'lon': ME.mapLon});
									}
								if(evt.keyCode == Mojo.Char.w){
										ME.mapLat = (parseFloat(ME.mapLat) + panning_var).toFixed(6);
										ME.mapGoto({'lat': ME.mapLat, 'lon': ME.mapLon});
									}
								if(evt.keyCode == Mojo.Char.a){
										ME.mapLon = (parseFloat(ME.mapLon) - panning_var).toFixed(6);
										ME.mapGoto({'lat': ME.mapLat, 'lon': ME.mapLon});
									}
								if(evt.keyCode == Mojo.Char.d){
										ME.mapLon = (parseFloat(ME.mapLon) + panning_var).toFixed(6);
										ME.mapGoto({'lat': ME.mapLat, 'lon': ME.mapLon});
									}
							}else{
									return;
								}
					} else if(ME.searchBarFocused){
							if(ME.controller.get("searchBar").mojo.getValue() == ''){
								if(! ME.fqsDrawerModel.open){
									ME.controller.get("fqsDrawer").mojo.toggleState();
									var opacityOfQSC = 0;
									var f = function(){
											if(opacityOfQSC == 10){
												if(_timer){
													clearInterval(_timer);
													_timer = undefined;
												}
											}
											ME.controller.get("quickSearchDrawerContainer").style.opacity = opacityOfQSC / 10;
											opacityOfQSC++;
										};
									var _timer = setInterval(f, 20);
								}
							}else if(ME.fqsDrawerModel.open){
									ME.controller.get("fqsDrawer").mojo.toggleState();
									var opacityOfQSC = 10;
									var f = function(){
											if(opacityOfQSC == 0){
												if(_timer){
													clearInterval(_timer);
													_timer = undefined;
												}
											}
											ME.controller.get("quickSearchDrawerContainer").style.opacity = opacityOfQSC / 10;
											opacityOfQSC--;
										};
									var _timer = setInterval(f, 80);
								}
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
			ME.autoPanning = false;
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
					//var style = "left:" + (evt.move.x - ME.gblDraggingEventXY.x + (0 - (ME.w/2))) + "px;";
					//style = style + "top:" + (evt.move.y - ME.gblDraggingEventXY.y + (0 - (ME.h/2))) + "px;";
					var style = "left:" + (evt.move.x - ME.gblDraggingEventXY.x) + "px;";
					style = style + "top:" + (evt.move.y - ME.gblDraggingEventXY.y) + "px;";
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
							// 听说地图拖动动画是200毫秒, 我们设定500毫秒再获取
							setTimeout(function(){
									var center = ME.map.getCenter();
									ME.mapGoto({'lat': center.lat, 'lon': center.lng, "fromAction": "drag"});
									//ERROR("SMART - MAP - HELPER: lat/lon: " + center.lat + "/" + center.lng);
								}, 500);
							if(ME._dragTimer)
								ME._dragTimer = undefined;
							// Drag事件已经结束
							ME.inDrag = false;
							//ERROR("-----Drag end-----move x,y: " + evt.move.x + "," + evt.move.y);
							// 不再相信DragEnd
							// 恢复地图原来位置(0,0)
							//var style = "top:" + (0 - (ME.h/2)) + "px;left:" + (0 - (ME.w/2)) + "px;";
							var style = "top:0px;left:0px;";
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
					// 200毫秒没有dragging事件，我们确定dragEnd已经发生
					ME._dragTimer = setTimeout(ME._dragTimerFunc, 200);
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
							ME.updateBottomLine("Scale<br><font color='red'>" + evt.scale.toFixed(6) + "</font><br>mapZoom");
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
									// 所以我们在500毫秒后,恢复原来放大级别(1)
									setTimeout(function(){
											var scale1 = "-webkit-transition: none "/* + how*/ + ";-webkit-transform: scale(1);";
											ME.controller.get("map").setStyle(scale1);
											var resume = "-webkit-transition: -webkit-transform 0.1s ease-in;-webkit-transform: scale(1);";
											ME.controller.get("map").setStyle(resume);
										}, 500);
									if(! ME.inDrag)	
										ME.controller.stopListening(
												ME.controller.document,
												"gesturechange",
												ME.handleGestureChange.bind(ME)
											);
									};
							// 200毫秒没有GestureChange事件，我们认为是GestureEnd了
							ME._gestureTimer = setTimeout(ME._gestureTimerFunc, 200);
						}
			}catch(e){
					ERROR("@@@@@ larrymaps#smartMapHelper gots ERRORs: " + e);
				}
		},

	handleBcontentTap: function(evt){
		if(ME.isBcontentScaled){
				ME.controller.get("rcontent").setStyle("font-size: 12px; font-weight: normal;");
				ME.isBcontentScaled = false;
			}else{
					ME.controller.get("rcontent").setStyle("font-size: 14px; font-weight: bold;");
					ME.isBcontentScaled = true;
				}
		},

	handlePopupMenuTap: function(cmd){
			if(typeof(cmd) == "string" && cmd.match(/^(MAP|HYB|SAT|PER)$/)){
				var maptype = cmd;
				cmd = "changeMapType";
			}
			switch(cmd){
			case "showPanel":
				this.showHidePanel();	
				break;
			case "traffic":
				this.showHideTraffic();	
				break;
			case "changeMapType":
				this.setMapType(maptype);
				break;
			case "shareLocation":
				this.prepareEmailMsg({'fake': true, 'lat': ME.mapLat, 'lon': ME.mapLon, 'zoom': ME.mapZoomLevel});
				break;
			case "getDistance":
				if(! this.inMeasure){
					this.inMeasure = true;
					this.showBox("进入测距模式...", "后退手势退出");
					this.hideMask();
					this.__tmpSearchKeyword = ME.controller.get("searchBar").mojo.getValue();
					this.controller.get("searchBar").mojo.setValue("请点击地图开始测距(后退手势退出)!");
					this.closeBox();
				} else {
					this.controller.get("searchBar").mojo.setValue(ME.__tmpSearchKeyword);
					this.inMeasuring = false;
					this.inMeasure = false;
					this.__distUtil.cancelMeasuring();
				}
				break;
			}
		},
	
	showHideTraffic: function(){
			if(! ME.trafficLayer)
				ME.trafficLayer = new BMap.TrafficLayer();
			if(! ME.trafficShowed){
					ME.map.addTileLayer(ME.trafficLayer);
					ME.trafficShowed = true;
				}else{
						ME.map.removeTileLayer(ME.trafficLayer);
						ME.trafficShowed = false;
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
		if(cmd && cmd == "show"){
				ME.controller.get("panel").style.display = "block";
				ME.panelShowed = true;
				ME.showMask();
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
			var style = "display: block;-webkit-transform: scale(1.2);top:" + (pos.y - 16) + "px;left:" + (pos.x - 16) + "px;";
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
			var point,poi;
			poi = {};
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
					// 处于调整偏移量状态时,不会执行到这里
					// pos.fake: true -- 我们是直接调用此函数,而此时lat,lon是GPS坐标。因此不能再加减偏移量
					if(pos.fake != true){
						poi.lat = (parseFloat(point.lat) - parseFloat(ME.larryCookie.privateOffset.lat)).toFixed(6);
						poi.lon = (parseFloat(point.lng) - parseFloat(ME.larryCookie.privateOffset.lon)).toFixed(6);
					} else {
							poi.lat = pos.lat;
							poi.lon = pos.lon;
						}
				} else {
						poi.lat = point.lat;
						poi.lon = point.lng;
					}
			var msg = "<br>坐标信息: " + poi.lat + "," + poi.lon + "<br>";
			
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
						"lat=" + poi.lat + 
						"&lon=" + poi.lon + 
						"&z=" + zoom + 
						"&t=" + ME.gblMapType + 
						"&offsetON=" + ME.larryCookie.privateOffset.enabled + 
						"&oslat=" + ME.larryCookie.privateOffset.lat +
						"&oslon=" + ME.larryCookie.privateOffset.lon;
			var link_google = "<a href='http://maps.googleapis.com/maps/api/staticmap?" + 
						"center=" + poi.lat + "," + poi.lon +
						"&zoom=" + (zoom - 1 ? zoom - 1 : 1) +
						"&size=320x400" +
						"&language=zh_CN" + 
						"&sensor=false" + 
						"&markers=color:blue|label:X|" + poi.lat + "," + poi.lon +
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
						"'>查看Google Map静态图</a>";
			msg = msg + link_google +  "<br><a href='" + link + "'>在Larry Maps上查看</a><br>";
			msg = msg + "<font size='-3' color='purple'>链接内容:<br>" + link + "</font><br>";
			var style = "body{padding: 5px;margin: 0px;text-align: left;background: #eeffee;font-size: 14px;}";
			var send = function(v){
					var address;
					address = v.addressComponents.province + v.addressComponents.city + v.addressComponents.district + v.addressComponents.street + v.addressComponents.streetNumber;
					msg = "地址:" + address + msg;
					ME.emailStuff(msg, style);
					ME.stopSpinner();
					ME.closeBox();
				};
			ME.getLocationFromPoint(new BMap.Point(poi.lon, poi.lat), send);
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

	handleBcontentHold: function(evt){
			// 定义有x,y使电邮图标显示到指定位置，定义lat,lon使发送信息为指定的，而不是x,y位置的
			ME.showEmailButton({'x': evt.down.x, 'y': evt.down.y, 'lat': ME.mapLat, 'lon': ME.mapLon});
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

	autoUpdateBaiduMapGeoOffsets: function(obj){ // obj:
												 // {
												 // lat: float, 
												 // lon: float, 
												 // from: number[0~3], 
												 // to: number[2~4],
												 // callback: function  // 传递参数:
												 // 					// {"error":0,"x":"MTEwLjI5NjM5ODIwMTg=","y":"MjUuMjE3MDk0OTk4MjE4"}
												 // 					// 注： x,y 可用于 new BMap.Point(x, y)
												 // }
			if(! obj || ! (obj.lat && obj.lon))
				return;
			var from = obj.from ? obj.from : 0;
			var to = obj.to ? obj.to : 4;
			var adjGeoURL = "http://api.map.baidu.com/ag/coord/convert";
			var adjGeoURLParams = {
					"from": from,
					"to": to,
					"x": obj.lon,
					"y": obj.lat
				};
			if(obj.callback){
				var f = obj.callback;
			} else {
					var f = function(response){
							var rspJSON = response.responseText.evalJSON(true);
							if(! rspJSON || rspJSON.error != 0){
								f_fail();
								return;
							}
							// 转换坐标
							var point = new BMap.Point(rspJSON.x, rspJSON.y);
							var offsets = {};
							offsets.lat = (parseFloat(point.lat) - parseFloat(adjGeoURLParams.y)).toFixed(6);
							offsets.lon = (parseFloat(point.lng) - parseFloat(adjGeoURLParams.x)).toFixed(6);

							var cookie = new larryCookie();
							if(!(isNaN(offsets.lat) || isNaN(offsets.lon))){
								cookie.savePrivateOffset(offsets);
							}
							setTimeout(function(){
									if(cookie)
										delete cookie;
								}, 2000);
							if(AQ)
								delete AQ;
						};
				}
			var f_fail = function(){
					Mojo.Controller.stageController.activeScene().showAlertDialog(
							{
								allowHTMLMessage: true,
								title: "很遗憾",
								message: "我们<font color='red'>不能自动更新</font>偏移量，<br>" + 
										 "可能的原因有:<br>" +
										 "1, 网络情况不好(下次可能正常)<br>" +
										 "2, 百度终止提供纠偏服务<br>" +
										 "<font color='green'>无论如何,请按下面的按钮. :-) </font>" +
										 "<font color='blue'>要取消此提示，请到设置页面取消自动纠偏!</font>",
								choices: [{label: $L("遗憾地返回")}]
							}
						);
					if(AQ)
						delete AQ;
				};
			var AQ = new Ajax.Request(
					adjGeoURL,
					{
						method: "GET",
						requestHeaders: {Accept: 'application/json'},
						parameters: adjGeoURLParams,
						onSuccess: f.bind(this),
						onFailure: f_fail
					}
				);
		},

	dealAutoFixOffsets: function(){
			if(! ME.autoFixOffset){
				return;
			}
			ME.autoUpdateBaiduMapGeoOffsets({lat: ME.mapLat, lon: ME.mapLon});
		},
	
	prepareToAdjust: function(){
			try{
			if(! this.larryCookie)
				this.larryCookie = new larryCookie();
			if(! this.larryCookie.privateOffset.enabled){
					this.showBox("你在[选项]里没有启用偏差修正...", "请先启用使用偏差");
					this.closeBox(3000);
					this.inAdjust = undefined;
					this.menuModel.items[1].label = "调整偏差量";
					return;
				}
			var maskDIV = this.controller.get("adjustMask");
			var ballDIV = this.controller.get("adjustBall");
			var offsetDIV = this.controller.get("offsets");
			var show = "display: block;height:" + ME.h + "px;width:" + ME.w + "px;";
			this.__ballPos = {'top': (ME.h - 46) / 2, 'left': (ME.w - 46) / 2};
			var ballStyle = "display:block;top:" + this.__ballPos.top + "px;left:" + this.__ballPos.left + "px;";
			// 标志用于滑动的小球
			ballDIV.setStyle(ballStyle);
			maskDIV.setStyle(show);
			offsetDIV.setStyle("display:block;");
			// 隐藏所有盖在地图上的东西
			this.stopSpinner();
			this.showHidePanel("hide");
			this.closeBox(500);
			this.map.closeInfoWindow();
			// 标志地图中心点,此点将用于保存用户调整时的坐标（GPS坐标与偏移量的合成体）
			this.markers[2] = this.placeMarker(
											{
												'point': this.map.getCenter(), 
												'index': 2,
												'img': {
														'url': 'images/gps-cross-adjust.png',
														'size': {'width': 46, 'height': 46},
														'anchor': {'width': 23, 'height': 23}
													}
											}
											);
			// 存放临时偏移量,初始值为COOKIE保存的值
			this.tmpOffset = {
								'lat': this.larryCookie.privateOffset.lat, 
								'lon': this.larryCookie.privateOffset.lon, 
								'enabled': true
							};
			this.controller.listen(
					"adjustBall",
					Mojo.Event.dragStart,
					this.setDragStartPos.bind(this)
				);
			this.controller.listen(
					"adjustBall",
					Mojo.Event.dragging,
					this.setBallPosition.bind(this)
				);
			}catch(e){
					ERROR("@@@@@ larrymaps#prepareToAdjust got ERRORs: " + e);
				}
		},
	finishAdjustment: function(action){
			try{
			if(! this.larryCookie)
				this.larryCookie = new larryCookie();
			var maskDIV = this.controller.get("adjustMask");
			var hide = "display: none;height: 0px; width: 0px;";
			maskDIV.setStyle(hide);
			if(this.tmpOffset.lat == 0 || this.tmpOffset.lon == 0 || (this.tmpOffset.lat == this.larryCookie.privateOffset.lat && this.tmpOffset.lon == this.larryCookie.privateOffset.lon))
				return;
			if(action == "save"){
					this.showBox("<font color='green'>你已经成功保存新的GPS偏移量</font><br>在GPS打开时可立即使用o0。0o", "祝贺你");
					this.closeBox(3000);
					// 保存偏移量
					this.larryCookie.savePrivateOffset(this.tmpOffset);
				}else{
						this.showBox("你<font color='red'>没有保存</font>GPS偏移量,<br>就<font color='red'>退出</font>了调整偏移状态!!!", "实在太可惜了");
						this.closeBox(2500);
					}
			setTimeout(function(){this.map.removeOverlay(this.markers[2]);}.bind(this), 1500);
			this.controller.stopListening("adjustBall",Mojo.Event.dragStart,this.setDragStartPos.bind(this));
			this.controller.stopListening("adjustBall",Mojo.Event.dragging,this.setBallPosition.bind(this));
			}catch(e){
					ERROR("@@@@@ larrymaps#finishAdjustment got ERRORs: " + e);
				}
		},
	setDragStartPos: function(evt){
			this.__downPos = {'x': evt.down.x, 'y': evt.down.y}
		},
	setBallPosition: function(evt){
			// 手指在移动中，禁止自动更新中心点坐标到GPS坐标
			this.inAdjusting = true;
			this.__movePos = {'x': evt.move.x, 'y': evt.move.y};
			this.__ballPosNew = {	'left':this.__ballPos.left + (this.__movePos.x - this.__downPos.x) ,
									'top': this.__ballPos.top + (this.__movePos.y - this.__downPos.y)
								};
			var style = "left:" + this.__ballPosNew.left + "px;top:" + this.__ballPosNew.top + "px;";
			this.controller.get("adjustBall").setStyle(style);
			this.controller.get("offsets").innerHTML = "(缩放可用)<br>(完成后请从程序菜单保存)<br>" + style;
			// 我不相信 DragEnd 事件, 所以用自己的办法做DragEnd要做的事:
			// 保存这些改变的量
			// 事情是这样的： 如果300毫秒内没有dragging事件，我们认为是时候dragEnd了.  ;-)
			var dragendFunc = function(){
					// 手指不拖动了，我们重新自动更新中心点坐标到GPS坐标
					// 延长1.5秒，用处是防止GPS在1秒的交叉时间内变换新坐标
					var THIS = this;
					setTimeout(function(){
							THIS.inAdjusting = false;
							}, 1500
						);
					this.__ballPos = {'top': this.__ballPosNew.top, 'left': this.__ballPosNew.left};
					// 如果处于自动定位状态,禁用动画移动地图.
					// 如果不在GPS定位状态,启用动画,这样视觉效果会好些.
					var panOpt = {};
					if(this._trackMeTimer){
							panOpt.noAnimation = true;
						}
					this.map.panTo(
						this.map.pixelToPoint(
							new BMap.Pixel(
								// this.__ballPos.left + ((ME.w + 46) / 2), 
								// this.__ballPos.top + ((ME.h + 46) / 2)
								this.__ballPos.left + (46 / 2),
								this.__ballPos.top + (46 / 2)
							)
						), 
						panOpt);

					// 获取偏移量,因为移动地图需要时间,所以用定时器获取:
					// 没有动画时,超时时间为50ms
					// 有动画时,超时时间为1200ms
					var t;
					if(panOpt.noAnimation){
							t = 50;
						}else{
								t = 1200;
							}
					setTimeout(function(){
							if(this._trackMeTimer){
									// 正处于GPS定位状态,中心点使用GPS标志的坐标
									this.markers[2].setPosition(this.gpsMarker.getPosition());
								}else{
										// 非GPS定位状态,从地图中心点获取
										this.markers[2].setPosition(this.map.getCenter());
									}
							// 现在markers[2]保存有GPS坐标(mapLat, mapLon)及偏移量(offsetLat, offsetLon)
							// 保存到tmpOffset里面
							this.tmpOffset.lat =  (this.markers[2].getPosition().lat - this.mapLat).toFixed(6);
							this.tmpOffset.lon =  (this.markers[2].getPosition().lng - this.mapLon).toFixed(6);
							this.controller.get("offsets").innerHTML =  "(缩放可用)<br><font color='red'>" +
												"(完成后请从程序菜单保存)</font><br>" +
												this.tmpOffset.lat + "," + 
												this.tmpOffset.lon;
						}.bind(this), t);
				}.bind(this);
			if(this.__catchDragEndTimer){
					clearTimeout(this.__catchDragEndTimer);
					this.__catchDragEndTimer = undefined;
				}
			this.__catchDragEndTimer = setTimeout(dragendFunc, 300);
		},
	
	viewGoogleStaticMap: function(params){
		if(! params || ! params.staticMapURL)
			return;
		var stageName = "googleStaticMapStage";
		var sceneName = "googlestaticmap";
		var appController = Mojo.Controller.getAppController();
		params.winHeight = params.winHeight ? params.winHeight : 320;
		params.winWidth = params.winWidth ? params.winWidth : 400;
		GSMStageController = appController.getStageController(stageName);
		if(GSMStageController){
			GSMStageController.swapScene(sceneName, params);
			GSMStageController.activate();
		}else{
			appController.createStageWithCallback(
					{
						name: stageName,
						lightweight: true
					},
					function(sc){
						sc.pushScene(sceneName, params);
					}
				);
		}
	},

	calcDirectionAlpha: function(pointA, pointB){
		if(! ((pointA instanceof BMap.Point) && (pointB instanceof BMap.Point)))
			return null;
		var pA = ME.map.pointToPixel(pointA);
		var pB = ME.map.pointToPixel(pointB);
		var x = pB.x - pA.x;
		var y = pB.y - pA.y;
		var z = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
		var r;
		if(x > 0){
			if(y < 0){
				r = Math.asin(x/z);
			}else if (y > 0){
				r = Math.PI - Math.asin(x/z);
			} else {
				r = Math.PI / 2;
			}
		} else if (x < 0){
			if(y > 0){
				r = Math.PI + Math.asin(-x/z);
			} else if(y < 0){
				r = (2 * Math.PI) - Math.asin(-x/z);
			} else {
				r = Math.PI * (3/2);
			}
		} else {
			if(y < 0){
				r = 0;
			} else if(y > 0){
				r = Math.PI;
			} else {
				r = null;
			}
		}
		return r;
	},

	// Update the flag of direction
	updateDirection: function(pA, pB){
		var alpha = ME.calcDirectionAlpha(pA, pB);
		if(alpha != null){
			var dStyle = "display: block;-webkit-transform: rotate("+((alpha/(Math.PI * 2)) * 360)+"deg);";
		} else {
			var dStyle = "display: none;-webkit-transform: rotate(0deg);";
		}
		ME.controller.get("director").setStyle(dStyle);
		//ME.updateBottomLine((alpha/(Math.PI * 2)) * 360);
	},

	handleCommand: function(evt){
		if (evt.type == Mojo.Event.command){
			switch(evt.command){
				case "go-pref":
					if(this.inAdjust)
						return;
					this.controller.stageController.pushScene("pref");
					break;
				case "go-help":
					if(this.inAdjust)
						return;
					this.controller.stageController.pushScene("help");
					break;
				case "toggleGPS":
					if(this.inAdjust)
						return;
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
				case "do-adjustment":
					if(! this.mapReady)
						break;
					if(! this.inAdjust){
							this.inAdjust = true;
							this.menuModel.items[1].label = "保存偏差量";
							this.prepareToAdjust();
						}else{
								this.inAdjust = undefined;
								this.menuModel.items[1].label = "调整偏差量";
								this.finishAdjustment("save");
							}
					break;
				case "showSubmenu":
					if(this.searchBarFocused){
							this.blurSearchBar();
						}
					if(! this.mapReady){
							this.checkNetwork(this);
							break;
						}
					var itemsMaptype = [
									{label: "街道地图", command: "MAP"},
									{label: "卫星路网", command: "HYB"},
									{label: "卫星地图", command: "SAT"},
									{label: "透视地图", command: "PER"}
								];
					var indexMaptype = 0;
					switch(ME.gblMapType){
						case "MAP":
							indexMaptype = 0;
							break;
						case "HYB":
							indexMaptype = 1;
							break;
						case "SAT":
							indexMaptype = 2;
							break;
						case "PER":
							indexMaptype = 3;
							break;
						default:
							indexMaptype = 0;
							break;
						}
					itemsMaptype[indexMaptype].iconPath = "images/palm-default/popup-item-checkmark.png";
					var items = [
									{
										label: "地图类型", 
										items: itemsMaptype
									
									},
									{label: "测距模式", command: "getDistance", iconPath: "images/ruler.png"},
									{label: "分享位置", command: "shareLocation", iconPath: "images/send-via-email.png"},
									{label: "交通路况", command: "traffic", iconPath: "images/traffic-icon.png"},
									{label: "数据面板", command: "showPanel", iconPath: "images/panel-off.png"}
								];
					if(this.inMeasure){
						items[1].iconPath = "images/ruler-color.png";
						items[1].label = "退出测距模式";
					} else {
						items[1].iconPath = "images/ruler.png";
						items[1].label = "测距模式";
					}
					if(this.trafficShowed){
						items[3].iconPath = "images/traffic-icon-on.png";
						items[3].label = "关闭交通路况";
					} else {
						items[3].iconPath = "images/traffic-icon.png";
						items[3].label = "交通路况";
					}
					if(this.panelShowed){
						items[4].iconPath = "images/panel-on.png";
						items[4].label = "关闭数据面板";
					} else {
						items[4].iconPath = "images/panel-off.png";
						items[4].label = "数据面板";
					}
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

				if(this.inAdjust){
						this.inAdjust = false;
						this.menuModel.items[1].label = "调整偏差量";
						this.finishAdjustment();
						evt.stop()
						return;
					}
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
						ME.closeBox(500);
						evt.stop();
						return;
					}
				if(this.searchBarFocused){
						ME.blurSearchBar();
						evt.stop();
						return;
					}

				//
				//
				if(ME.__distUtil){
					if(ME.__distUtil.getLength() != 0){
						var f = function(){
							ME.__distUtil.deletePoint(ME.__distUtil.getLength() -1);
							ME.___dpTimer = undefined;
						}
						// 如果我没有猜错的话，操作太快会卡死你的JJ.  ;-)
						if(! ME.___dpTimer)
							ME.___dpTimer = setTimeout(f, 300);
						evt.stop();
						return;
					} else {
							this.controller.get("searchBar").mojo.setValue(ME.__tmpSearchKeyword);
							ME.inMeasuring = false;
							ME.inMeasure = false;
						}
				}
				//
				//
				ME.map.closeInfoWindow();
				evt.stop();
			}
		if (evt.type == Mojo.Event.forward){
				if(this.inAdjust)
					return;
				this.showHidePanel();
				evt.stop();
			}
	    }
	});
