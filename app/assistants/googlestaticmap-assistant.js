/* by choetin AT gmail DOT com (L)2012 
 * @filename: googlestaticmap-assistant.js
 * */

var GooglestaticmapAssistant = Class.create({
	initialize: function(params){
		this.param = params;
	},
	setup: function(evt){
		this.controller.setupWidget(
			Mojo.Menu.appMenu,
			{omitDefaultItems: true},
			{
				visible: true,
				items:[
					Mojo.Menu.editItem,
					{
						label: "关闭", command: "close", shortcut: "b"
					}
				]
			}
		);
		this.controller.setupWidget(
			Mojo.Menu.commandMenu,
			{menuClass: "no-fade"},
			{
				items:
				[
					{label: "关闭", command: "close"},
					{label: "主界面", command: "back"}
				]
			}
		);
	},
	activate: function(evt){
		this.controller.get("staticMap").setStyle("height:" + this.param.winHeight + "px;width:" + this.param.winWidth + "px;");
		this.controller.get("staticMap").src = this.param.staticMapURL;
	},
	cleanup: function(evt){},
	handleCommand: function(evt){
		var larryStage = Mojo.Controller.getAppController().getStageController("larryStage");
		if(evt.type == Mojo.Event.command){
			if(evt.command == "close"){
				if(larryStage)
					larryStage.activate();
				Mojo.Controller.getAppController().closeStage("googleStaticMapStage");
			}
			if(evt.command == "back"){
				if(larryStage)
					larryStage.activate();
				else
					this.controller.showAlertDialog({
							title: "亲，你忘了吗?",
							message: "Larry Maps主界面已经被你关闭啦。",
							choices: [{label: "我记得了"}]
						});
			}
		}
	}
});
