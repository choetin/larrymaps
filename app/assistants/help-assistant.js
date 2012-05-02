/* by choetin AT gmail DOT com (L)2012 
 * @filename help-assistant.js
 * */

function HelpAssistant() {
	this.larryCookie = new larryCookie();
}

HelpAssistant.prototype.setup = function() {
	Mojo.Log.info("@@@@@ HelpAssistant#setup.");
	this.controller.setupWidget(
		Mojo.Menu.appMenu, 
		{omitDefaultItems: true}, 
		{
			visible: true,
			items: [
				Mojo.Menu.editItem,
				{label: "设置",command: "go-pref", shortcut: "s"}
			]
		}
		);
	this.controller.setupWidget(
			"myDrawer",
			{
				modelProperty: 'closed',
				drawerBottomOffset: 5,
				unstyled: false
			},
			{open: false}
		);

	this.controller.setupWidget(
			"toggleDrawer",
			{},
			{label: "贡献人员列表"}
		);
};

HelpAssistant.prototype.handleCommand = function(event){
	if (event.type == Mojo.Event.command) {
		switch (event.command) {
		case "go-pref":
			this.controller.stageController.pushScene("pref");
			break;
		default:
			break;
		}
	}
};

HelpAssistant.prototype.activate = function(event) {
	$("version").update("v" + this.larryCookie.appVersion);
	$("advList").update("贡献人员列表暂时留空<br>往后的日子慢慢加入<br>大家,加油.");
	var mail_link = "mailto:" + Mojo.appInfo.vendor_email + "?subject='Larry Maps Stuff...'";
	var api_vendor_link = "http://m.baidu.com";
	var api_license_link = "http://dev.baidu.com/wiki/map/index.php?title=%E4%BD%BF%E7%94%A8%E6%9D%A1%E6%AC%BE";
	this.controller.get("mailto").setAttribute("href", mail_link);
	this.controller.get("baidu").setAttribute("href", api_vendor_link);
	this.controller.get("api_license").setAttribute("href", api_license_link);
	this.controller.listen(
		this.controller.get("toggleDrawer"),
		Mojo.Event.tap,
		this.closeOpenIt.bind(this)
		);
};

HelpAssistant.prototype.closeOpenIt = function(evt){
		this.controller.get("myDrawer").mojo.toggleState();
	};

HelpAssistant.prototype.deactivate = function(event) {
};

HelpAssistant.prototype.cleanup = function(event) {
};
