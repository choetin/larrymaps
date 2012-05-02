	readChatLog: function(ID){
			var logObj =  this.LarryChatLogCookie.get();
			/*
			 for(var i=0; i<logObj.length; i++){
					logObj[i] = logObj[i].evalJSON();
					for(var j=0; j<logObj[i].LOG.length; j++){
							logObj[i].LOG[j] = logObj[i].LOG[j].evalJSON();
						}
				}
			*/
			if(ID){
				for(var i=0; i<logObj.length; i++){
					if(logObj[i].ID == ID){
							Mojo.Log.info("@@@@@ CookieAdapter#readChatLog: typeof logObj["+i+"]: "+typeof(logObj[i]));
							return logObj[i];
						} else {
							return null;
							}
					}
			} else {
				Mojo.Log.info("@@@@@ CookieAdapter#readChatLog: typeof logObj: "+typeof(logObj));
				return logObj;
				}
		},
	
	appendChatLog: function(ID, content){
			if(! (ID && typeof(ID) == "number" && (""+ID).match(/^\d{13}$/)))
				return false;
			this.LarryChatLog = this.readChatLog();
			var now = new Date();
			var TS = {"Date": now.getFullYear()+"/"+(now.getMonth()+1)+"/"+now.getDate(), "Time": now.getHours()+":"+now.getMinutes()+"."+now.getSeconds()};
			delete now;
			for(var i=0; i<this.LarryChatLog.length; i++){
					if(this.LarryChatLog[i].ID == ID){
							this.LarryChatLog[i].LOG.push({"Date": TS.Date, "Time":TS.Time, "content": content});
							Mojo.Log.info("@@@@@ CookieAdapter#saveChatLog: About to append existID: ["+ID+"]["+TS.Date+"]["+TS.Time+"]["+content);
							delete TS;
							this.LarryChatLogCookie.put(this.LarryChatLog);
							return this.LarryChatLog.length;
						}
				}
			var L = this.LarryChatLog.push({"ID": ID, "LOG":[{"Date": TS.Date, "Time":TS.Time, "content": content}]});
			Mojo.Log.info("@@@@@ CookieAdapter#appendChatLog: this.LarryChatLog.length:"+this.LarryChatLog.length);
			this.LarryChatLogCookie.put(this.LarryChatLog);
			delete TS;
			return this.LarryChatLog.length;
		}
