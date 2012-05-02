/* by choetin AT gmail DOT com (L)2012 
 * @filename: pref-assistant.js
 * */

var PrefAssistant = Class.create({
	initialize: function(args){
		this.apiRefURLChanged = false;
		this.larryCookie = new larryCookie();
		this.downloading = false;
		this.apiInfoCookieDATA = (new Mojo.Model.Cookie("apiInfoCookie")).get();
	},
	
	setup: function() {
  		this.controller.setupWidget(
 			"baiduapiurl",
 			{
 				hintText:'请输入正确的引用地址...',
 				multiline: true,
 				autoFocus: false,
 				holdToEdit: true,
				enterSubmits: true,
 				focusMode: Mojo.Widget.focusInsertMode,
				changeOnKeyPress: true
 			},
 			{
 				value: this.larryCookie.apiRefURL,
 				disabled: false
 			});

  		this.controller.setupWidget(
 			"apiLastUpdated",
 			{
 				multiline: false,
 				autoFocus: false,
 			},
 			{
 				value: this.apiInfoCookieDATA.lastUpdated,
 				disabled: true
 			});

  		this.controller.setupWidget(
 			"apiVerInCookie",
 			{
 				multiline: false,
 				autoFocus: false,
 			},
 			{
 				value: this.apiInfoCookieDATA.version,
 				disabled: true
 			});

  		this.controller.setupWidget(
 			"apiCSS",
 			{
 				multiline: false,
 				autoFocus: false,
 			},
 			{
 				value: this.apiInfoCookieDATA.cssReady,
 				disabled: true
 			});

  		this.controller.setupWidget(
 			"apiJS",
 			{
 				multiline: false,
 				autoFocus: false,
 			},
 			{
 				value: this.apiInfoCookieDATA.jsReady,
 				disabled: true
 			});
	
  		this.controller.setupWidget(
 			"userEmail",
 			{
 				hintText:'请输入正确的EMail地址...',
 				multiline: false,
 				autoFocus: false,
				focus: false,
 				holdToEdit: false,
 				focusMode: Mojo.Widget.focusSelectMode,
				textCase: Mojo.Widget.steModeLowerCase,
				changeOnKeyPress: true
 			},
 			{
 				value: this.larryCookie.userEmail,
 				disabled: false
 			});	

  		this.controller.setupWidget(
 			"ID",
 			{
 				multiline: false,
 				autoFocus: false,
 				holdToEdit: false,
 				focusMode: Mojo.Widget.focusSelectMode,
				textCase: Mojo.Widget.steModeLowerCase,
				changeOnKeyPress: true
 			},
 			{
 				value: this.larryCookie.ID,
 				disabled: true
 			});

  		this.controller.setupWidget(
 			"offsetLat",
 			{
 				multiline: false,
 				autoFocus: false,
				focus: false,
				changeOnKeyPress: true,
 				focusMode: Mojo.Widget.focusSelectMode,
				modifierState: Mojo.Widget.numLock,
				charsAllow: function(c){
					return (Mojo.Char.isDigit(c) || c == 46); // 仅接受数字及英文句点"."
					}
 			},
 			this.oslatModel = {
 				value: this.larryCookie.privateOffset.lat,
 				disabled: false
 			});

  		this.controller.setupWidget(
 			"offsetLon",
 			{
 				multiline: false,
 				autoFocus: false,
				focus: false,
				changeOnKeyPress: true,
 				focusMode: Mojo.Widget.focusSelectMode,
				modifierState: Mojo.Widget.numLock,
				charsAllow: function(c){
					return (Mojo.Char.isDigit(c) || c == 46);
					}
 			},
 			this.oslonModel = {
 				value: this.larryCookie.privateOffset.lon,
 				disabled: false
 			});

		this.controller.setupWidget(
			"autoAGcheckBox",
			{
				trueValue: true,
				falseValue: false,
			},
			this.agBoxModel = {
				value: this.larryCookie.privateOffset.autoUpdate,
				disabled: (! this.larryCookie.privateOffset.enabled)
			}
		);

		this.controller.setupWidget(
			"mapTypeSelector",
			{
				label: "地图类型",
				choices:[
						{label: "普通地图", value: "MAP"},
						{label: "卫星路网地图", value: "HYB"},
						{label: "卫星地图", value: "SAT"},
						{label: "透视地图", value: "PER"}
					]
			},
			{
				value: this.larryCookie.lastViewMapType,
				disable: false
			}
			);

		this.controller.setupWidget(
			"speedUnit",
			{
				label: "使用的速度单位",
				choices:[
						{label: "公里/小时", value: "kmph"},
						{label: "米/秒", value: "mps"}
					]
			},
			{
				value: this.larryCookie.speedUnit,
				disable: false
			}
			);

		this.controller.setupWidget(
			"privateOffsetOn",
			{
				trueLabel: "启用",
				falseLabel: "禁用"
			},
			this.prvtOSonModel = {
				value: this.larryCookie.privateOffset.enabled
			}
			);
			this.controller.setupWidget(
				Mojo.Menu.appMenu, 
				{omitDefaultItems: true},
				{
					visible: true,
					items: [
							Mojo.Menu.editItem,
							{label: "更新API", 
								items: [
										{label: "更新JS", command: "updateJS"},
										{label: "更新CSS", command: "updateCSS"},
										{label: "更新全部", command: "updateALL", shortcut: "u"}
									]},
							{label: "帮助", command: "go-help", shortcut: "h"}
						]
				});
		this.controller.setupWidget(
			"prefSpinner",
			{
				spinnerSize: "large",
				fps: 30
			},
			this.spinnerModel = {
					spinning: true
				}
			);
		},
	
	activate: function(event) {
			// 此变量用于判断API引用地址是否改变
			// 若已经改变,则在用户退出此界面时提示用户需要手动更新API
			// 以使新引用地址生效
			if(! this.apiRefURLChanged)
				this.oldRefURL = this.larryCookie.apiRefURL;
			this.controller.listen(
					this.controller.get("userEmail"),
					Mojo.Event.propertyChange,
					this.updateUserEmail.bind(this)
				);
			this.controller.listen(
					this.controller.get("mapTypeSelector"),
					Mojo.Event.propertyChange,
					this.setCookieLastViewMaptype.bind(this)
				);
			this.controller.listen(
					this.controller.get("speedUnit"),
					Mojo.Event.propertyChange,
					this.setSpeedUnit.bind(this)
				);
			this.controller.listen(
					this.controller.get("ID"),
					Mojo.Event.tap,
					this.copyID.bind(this)
				);
			this.controller.listen(
					this.controller.get("privateOffsetOn"),
					Mojo.Event.propertyChange,
					this.setOffsetUsage.bind(this)
				);
			this.controller.listen(
					this.controller.get("offsetLat"),
					Mojo.Event.propertyChange,
					this.updatePrivateOffset.bind(this)
				);
			this.controller.listen(
					this.controller.get("offsetLon"),
					Mojo.Event.propertyChange,
					this.updatePrivateOffset.bind(this)
				);
			this.controller.listen(
					this.controller.get("baiduapiurl"),
					Mojo.Event.propertyChange,
					this.updateApiRefURL.bind(this)
				);
			this.controller.listen(
					this.controller.get("autoAGcheckBox"),
					Mojo.Event.propertyChange,
					this.setAutoAG.bind(this)
				);

			if(this.larryCookie.privateOffset.autoUpdate){
				this.oslatModel.disabled = true;
				this.oslonModel.disabled = true;
				this.controller.modelChanged(this.oslatModel);
				this.controller.modelChanged(this.oslonModel);
			}

			$("version").update("v" + this.larryCookie.appVersion);
			this.noNetworkMsg = {
							allowHTMLMessage: true,
							title: "好像没有网络",
							message: "<b>不能完成指定的操作! :-(</b><br>Larry Maps<font color='red'>无法更新</font>,<br>请<font color='green'>启用网络</font>再试.",
							choices: [{label: "返回", value: "nothing"}]
							};

			if(this.controller.get("userEmail").mojo.getValue() != '')
				this.controller.setInitialFocusedElement(null);
		},

	startSpinner: function(){
			var h = parseInt(this.larryCookie.devInfo.winHeight);
			var w = parseInt(this.larryCookie.devInfo.winWidth);
			var styleSpinner = "display:block;top:" + ((h - 128) / 2) + "px;left:" + ((w - 128) / 2) + "px;";
			var styleSpinnerMask = "display: block;maxHeight:" + h + ";width:" + w + "px;";
			this.controller.get("prefSpinner").mojo.start();
			this.controller.get("prefSpinner").setStyle(styleSpinner);
			this.controller.get("prefSpinnerMask").setStyle(styleSpinnerMask);
			var newLines = "<br />";
			for(var i=0; i<10; i++){
					newLines += newLines;
				}
			this.controller.get("prefSpinnerMask").innerHTML = newLines;
		},

	stopSpinner: function(){
			this.controller.get("prefSpinner").mojo.stop();
			this.controller.get("prefSpinner").setStyle("display: none");
			this.controller.get("prefSpinnerMask").setStyle("display: none");
		},
	
	setAutoAG: function(evt){
			if(evt.value == true){
				this.oslatModel.disabled = true;
				this.oslonModel.disabled = true;
				this.controller.modelChanged(this.oslatModel);
				this.controller.modelChanged(this.oslonModel);
			} else if(evt.value == false){
				this.oslatModel.disabled = false;
				this.oslonModel.disabled = false;
				this.controller.modelChanged(this.oslatModel);
				this.controller.modelChanged(this.oslonModel);
				}
		this.larryCookie.savePrivateOffset({
				lat: this.controller.get("offsetLat").mojo.getValue(),
				lon: this.controller.get("offsetLon").mojo.getValue(),
				autoUpdate: evt.value
			});
		},

	updateUserEmail: function(evt){
			var v = evt.value;
			if(/\w+[_.\d]{0,30}@.*\..*/.test(v)){
					this.larryCookie.saveUserEmail(v);
				}
		},

	updateApiRefURL: function(evt){
			var v = evt.value;
			if(/^http\:\/\/api\.map\.baidu\.com\/api\?v\=\d\.\d$/.test(v)){
					this.larryCookie.changeApiRefURL(v);
					if(this.oldRefURL != v)
						this.apiRefURLChanged = true;
				}
		},

	setCookieLastViewMaptype: function(evt){
			this.larryCookie.updateLastViewMapType(evt.value);
		},

	copyID: function(event){
			var self = this;
			function f(){
				self.controller.stageController.setClipboard(self.controller.get("ID").mojo.getValue());
			}
			this.controller.popupSubmenu({
				onChoose: f,
				placeNear: event.target,
				items:[{label: "复制到剪贴板", command: "nothing"}]
				});
		},

	setSpeedUnit: function(evt){
			this.larryCookie.setSpeedUnit(evt.value);
		},

	setOffsetUsage: function(evt){
			this.larryCookie.savePrivateOffset({
				enabled: evt.value,
				lat: this.controller.get("offsetLat").mojo.getValue(),
				lon: this.controller.get("offsetLon").mojo.getValue()
				});
			if(evt.value == false){
				this.agBoxModel.disabled = true;
				this.controller.modelChanged(this.agBoxModel);
			} else {
				this.agBoxModel.disabled = false;
				this.controller.modelChanged(this.agBoxModel);
			}
		},

	updatePrivateOffset: function(evt){
			this.larryCookie.savePrivateOffset({
				enabled: this.larryCookie.privateOffset.enabled,
				lat: this.controller.get("offsetLat").mojo.getValue(),
				lon: this.controller.get("offsetLon").mojo.getValue()
				});
		},

	downloadStatChecker: function(T){
			if(T)
				self = T;
			if(self.updater.apiReady){
					clearInterval(self.checkerTimer);
					self.stopSpinner();
					delete self.updater;
				}else{
						if(self.updater.jsTried && self.updater.cssTried){
								Mojo.Controller.stageController.activeScene().showAlertDialog({
										allowHTMLMessage: true,
										title: "确定本次下载失败",
										message: "<font color='red'>抱歉,我已经很努力了.<br>但这次尝试还是失败了.请再试试看...</font>"
									});
								self.stopSpinner();
							}
					}
		},

	deactivate: function(event) {
		},
	
	cleanup: function(event) {
		this.controller.stopListening(this.controller.get("userEmail"),Mojo.Event.propertyChange,this.updateUserEmail.bind(this));
		this.controller.stopListening(this.controller.get("ID"),Mojo.Event.tap,this.copyID.bind(this));;
		this.controller.stopListening(this.controller.get("mapTypeSelector"),Mojo.Event.propertyChange,this.setCookieLastViewMaptype.bind(this));
		this.controller.stopListening(this.controller.get("privateOffsetOn"),Mojo.Event.propertyChange,this.setOffsetUsage.bind(this));
		this.controller.stopListening(this.controller.get("offsetLat"),Mojo.Event.propertyChange,this.setOffsetUsage.bind(this));
		this.controller.stopListening(this.controller.get("offsetLon"),Mojo.Event.propertyChange,this.setOffsetUsage.bind(this));
		this.controller.stopListening(this.controller.get("baiduapiurl"),Mojo.Event.propertyChange,this.updateApiRefURL.bind(this));
		this.controller.stopListening(this.controller.get("speedUnit"),Mojo.Event.propertyChange,this.setSpeedUnit.bind(this));
		this.controller.stopListening(this.controller.get("autoAGcheckBox"),Mojo.Event.propertyChange,this.setAutoAG.bind(this));
		},
	
	handleCommand: function(evt){
		if(evt.type == Mojo.Event.command){
			var self = this;
			switch(evt.command){
				case "go-help":
					this.controller.stageController.pushScene("help");
					break;
				case "updateJS":
					if(ME.networkAvailable){
						if(this.updater)
							return;
						this.startSpinner();
						this.updater = new APIUpdater("js");
						this.checkerTimer = setInterval(this.downloadStatChecker(this), 2000);
					}else{
						this.controller.showAlertDialog(this.noNetworkMsg);
						break;
						}
					break;
				case "updateCSS":
					if(ME.networkAvailable){
						if(this.updater)
							return;
						this.startSpinner();
						this.updater = new APIUpdater("css");
						this.checkerTimer = setInterval(this.downloadStatChecker(this), 2000);
					}else{
						this.controller.showAlertDialog(this.noNetworkMsg);
						break;
						}
					break;
				case "updateALL":
					if(ME.networkAvailable){
						if(this.updater)
							return;
						this.startSpinner();
						this.updater = new APIUpdater();
						this.checkerTimer = setInterval(this.downloadStatChecker(this), 2000);
					}else{
						this.controller.showAlertDialog(this.noNetworkMsg);
						break;
						}
					break;
				default:
					break;
			}
		}
	if(evt.type == Mojo.Event.back){
		if(this.apiRefURLChanged){
			evt.stop();
			if(this.downloading)
				return;
			var self = this;
			this.controller.showAlertDialog({
					allowHTMLMessage: true,
					title: "温馨提醒",
					message: "要想使刚才新的引用地址<font color='green'>生效</font>,<br>请记得从程序左上角的<br>菜单进行<font color='red'>手动更新API</font>.<br>当然,你需要有可用的网络连接.",
						choices: [
								{label: "好的,现在更新", value: "update", type: "affirmative"},
								{label: "我会的,稍后", value: "dismiss", type: "dismiss"}
							],
					onChoose: function(value){
							switch(value){
								case "update":
									if(self.updater)
										return;
									self.startSpinner();
									self.updater = new APIUpdater("all", self.controller.get("baiduapiurl").mojo.getValue());
									self.apiRefURLChanged = false;
									self.downloading = true;
									self.checkerTimer = setInterval(self.downloadStatChecker(self), 2000);
									break;
								case "dismiss":
									self.apiRefURLChanged = false;
									break;
								default:
									break;
								}
						}
				});
			}
		}
	}
});
