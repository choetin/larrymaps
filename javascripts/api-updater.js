/* by choetin AT gmail DOT com (L)2012 
 * @filename: api-updater.js
 * */

var APIUpdater = Class.create({
	initialize: function(fileType, refURL){
		Mojo.Log.info("@@@@@ APIUpdater#initialize.");
		// 默认API地址及版本
		// 私有变量
		this._app_path = "/media/cryptofs/apps/usr/palm/applications/cn.choetin.larry.maps/";
		this._css_file_path = this._app_path + "stylesheets/baidumaps.css";
		this._api_file_path = this._app_path + "javascripts/baidu-maps-api.js";
		this.mapapiURL = "http://api.map.baidu.com/api";
		this.mapapiVer = "1.3"; // changed from 1.2 to 1.3, on 2012.3.13
		this._which = "all";
		this.cssReady = false;
		this.jsReady = false;
		this.apiReady = false;
		this.cssTried = false;
		this.jsTried = false;
		this.reTry = 1;
		if(typeof(fileType) == "string" && (fileType == "css" || fileType == "js")){
			this._which = fileType;
		}
		// 提供指定URL,则使用提供的URL数据
		if (typeof(refURL) == "string" && refURL.match(/^http\:\/\/api.map.baidu.com\/api\?v\=\d\.\d$/)){
			var _url = refURL.split("\?");
			this.mapapiURL = _url[0];
			var _ver = _url[1].split("=");
			this.mapapiVer = _ver[1];
		}
		// 抓取URL实际地址
		var self = this;
		var requestX = new Ajax.Request(
			this.mapapiURL,
			{
				method: "GET",
				parameters: {"v": this.mapapiVer},
				onSuccess: function(para){
					Mojo.Log.info("@@@@@ Fetch: responseText:[" + para.responseText +"]");
					if(para.responseText == ""){
						if(self.reTry <= 3){
							Mojo.Controller.stageController.activeScene().showAlertDialog({
								allowHTMLMessage: true,
								title: "下载错误",
								message: $L("从API引用地址下载的数据为<font color='red'>空</font>,<br>可能是<font color='red'>引用地址不正确</font>或者<font color='red'>网络出问题</font>.<br>Larry Maps将自动<font color='green'>重试三次</font>..."),
								choices: [{label: $L("正在重试(" + self.reTry + "/3)")}]
							});
							var NEW = new APIUpdater(self._which);
							NEW.reTry = self.reTry;
							delete requestX;
							self = NEW;
							Mojo.Log.error("##### APIUpdater: reTry: " + self.reTry);
						}else{
								Mojo.Controller.stageController.activeScene().showAlertDialog({
									allowHTMLMessage: true,
									title: "下载失败",
									message: $L("<font color='red'>从API引用地址下载的数据为空,可能是引用地址不正确或者网络出问题!!!!<br>若多次下载都失败,请从左上角<font color='green'>[程序菜单]->[选项]</font>里设置API引用地址,<br>谢谢.</font>"),
									choices: [{label: $L("确定")}]
								});
							}
						self.reTry++
						}
					var orig = para.responseText.split("\"");
					Mojo.Log.info("@@@@@ orig[5]:" + orig[5]);
					Mojo.Log.info("@@@@@ orig[9]:" + orig[9]);
					var Tx = orig[9].split("\?");
					var T = Tx[1].split("\&");
					for (var i = 0; i < T.length; i++){
						T[i] = T[i].split("=");
					}
					var _api_css_url = orig[5];
					var _api_url_object = [
						orig[9].split("\?")[0],
						{v: T[0][1] || "1.2", key: T[1][1] || "", services: T[2][1] || "", t: T[3][1] || ""}
					];
					self.mapapiVer = _api_url_object[1].v;
					var THIS = self;
					if(orig[5] && orig[9]){
						if(self._which == "all"){
								// 如果下载速度太快，filemgr无法正确写入两个文件
								setTimeout(function(){THIS._update_JS_file(_api_url_object, THIS);}, 300);
								setTimeout(function(){THIS._update_CSS_file(_api_css_url, THIS);}, 1000);
							} else if(self._which == "css"){
								self.jsReady = true;
								self._update_CSS_file(_api_css_url, self);
							} else if(self._which == "js"){
								self.cssReady = true;
								self._update_JS_file(_api_url_object, self);
							}
					}
					delete requestX;
				},
				onFailure: function(err){
					Mojo.Controller.stageController.activeScene().showAlertDialog({
						title: "出错啦",
						message: $L("解析API引用地址失败：因为解析不到所需要的js及css文件地址.请尝试重新打开Larry Maps进行修复." + err),
						choices: [{label: $L("返回")}]
					});
					delete requestX;
				}
			}
		);
		this.filemgr = new FileMgrService();
	},

	_update_CSS_file: function(url, me){
		var filemgr = me.filemgr;
		var _css_file_path = me._css_file_path;
		var requestA = new Ajax.Request(
			url,
			{
				method: "GET",
				parameters: {},
				onSuccess:function(ta){
					T = ta.responseText;
					// 去掉下行的注释，使用本地图像以节省流量, 前提是你已懂得下载这些图片
					// T = T.replace(/http\:\/\/api.map.baidu.com\//g, "");
					filemgr.write({file: _css_file_path, str: T, append: false},
						function(response){
							me.cssReady = true;
							me.cssTried = true;
							var THIS = me;
							// 如何下载太快，显然Mojo.Model.Cookie反应不过来
							setTimeout(function(){THIS.updateApiInfo(THIS.jsReady, THIS.cssReady, THIS);}, 300);
						}.bind(this),
						function(err){
							Mojo.Controller.stageController.activeScene().showAlertDialog({
								title: "出错啦",
								message: $L("写入CSS文件失败： " + err.errorText),
								choices: [{label: $L("返回")}]
							});
						}.bind(this)
					);
					delete requestA;
				},
				onFailure:function(err){
					me.cssTried = true;
					Mojo.Controller.stageController.activeScene().showAlertDialog({
						title: "出错啦",
						message: $L("下载CSS文件失败： " + err.errorText),
						choices: [{label: $L("返回")}]
					});
					delete requestA;
				}
			}
		);
	},

	_update_JS_file: function(obj, me){
		var filemgr = me.filemgr;
		var _api_file_path = me._api_file_path;
		var requestB = new Ajax.Request(
			obj[0],
			{
				method: "GET",
				parameters: obj[1] || {},
				onSuccess:function(ta){
					T = ta.responseText;
					filemgr.write({file: _api_file_path, str: T, append: false},
						function(response){
							me.jsReady = true;
							me.jsTried = true;
							var THIS = me;
							// 如何下载太快，显然Mojo.Model.Cookie反应不过来
							setTimeout(function(){THIS.updateApiInfo(THIS.jsReady, THIS.cssReady, THIS);}, 1000);
						}.bind(this),
						function(err){
							Mojo.Controller.stageController.activeScene().showAlertDialog({
								title: "出错啦",
								message: $L("写入API JS文件失败： " + err.errorText),
								choices: [{label: $L("返回")}]
							});
						}.bind(this)
					);
					delete requestB;
				},
				onFailure:function(err){
					me.jsTried = true;
					Mojo.Controller.stageController.activeScene().showAlertDialog({
						title: "出错啦",
						message: $L("下载API JS文件失败： " + err.errorText),
						choices: [{label: $L("返回")}]
					});
					delete requestB;
				}
			}
		);
	},

	updateApiInfo: function(js, css, me){
			// 保存API安装信息
			if(js && css){
				me.apiReady = true;
				me.filemgr.cleanup();
				}
			var apiInfoCookie = new Mojo.Model.Cookie("apiInfoCookie");
			var date = new Date();
			var timeSt = date.getFullYear()+"/"+(date.getMonth()+1)+"/"+date.getDate()+"@"+date.getHours()+":"+date.getMinutes()+"."+date.getSeconds();
			var apiInfo = {"jsReady": js, "cssReady": css,"apiReady": me.apiReady, "version": me.mapapiVer || null, "lastUpdated": timeSt};
			apiInfoCookie.put(apiInfo);
			delete apiInfoCookie;
			var msg = "";
			msg = me.cssTried ? ("更新CSS文件" + (me.cssReady ? "<font color='green'>成功! :-)</font>":"失败!! :-(</font>")) : "";
			msg = msg + (me.jsTried ? ("更新JS文件" + (me.jsReady ? "<font color='green'>成功! :-)</font>":"失败!! :-(</font>")) : "");
			if(msg != "")
				Mojo.Controller.stageController.activeScene().showAlertDialog({
					title: "更新状态 - Larry Maps",
					allowHTMLMessage: true,
					message: msg,
					choices: [{label: $L("确定/继续")}]
				});
		}
});
