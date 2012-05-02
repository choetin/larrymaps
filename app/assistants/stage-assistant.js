/* by choetin AT gmail DOT com (L)2012 */

function AppAssistant(controller){
		this.controller = controller;
		this.stageName = "larryStage";
		this.sceneName = "larrymaps";
		this.stageController = undefined;
		this.paramsTransit = {};
	};

AppAssistant.prototype.handleLaunch = function(params){
		var self = this;
		if(params && params.target){
				this.paramsTransit = {target: params.target, disableSceneScroller: true};
			}
		this.stageController = this.controller.getStageController(this.stageName);
		if(this.stageController){
				if(params.target)
					this.stageController.swapScene(self.sceneName, self.paramsTransit);
				this.stageController.activate();
			}else{
					var pushLarry = function(sc){
							sc.pushScene(self.sceneName, self.paramsTransit);
						};
					this.controller.createStageWithCallback(
						{
							name: this.stageName
						},
						pushLarry
						);
				}
	};

