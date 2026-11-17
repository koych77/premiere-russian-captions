/* Local CEP host bridge. No network, no change to original audio/video clips. */
var RussianCaptions = (function () {
    var applied = {};
    function stringify(value) {
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'string') return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/[\u0000-\u001f\u2028\u2029]/g, function(c) { var h=c.charCodeAt(0).toString(16); return '\\u' + ('0000'+h).slice(-4); }) + '"';
        if (typeof value === 'number') return isFinite(value) ? String(value) : 'null';
        if (typeof value === 'boolean') return String(value);
        var parts=[], i;
        if (value instanceof Array) { for(i=0;i<value.length;i++) parts.push(stringify(value[i])); return '['+parts.join(',')+']'; }
        for(i in value) if(value.hasOwnProperty(i)) parts.push(stringify(i)+':'+stringify(value[i]));
        return '{'+parts.join(',')+'}';
    }
    function project() {
        if (!app.project) throw new Error('Откройте проект Premiere.');
        var active=app.project.activeSequence;
        if(!active)return app.project;
        var owners=[],exact=[],activeNode=active.projectItem?String(active.projectItem.nodeId):'';
        for(var i=0;i<app.projects.numProjects;i++){
            var p=app.projects[i];
            for(var j=0;j<p.sequences.numSequences;j++){
                var s=p.sequences[j];
                if(s.sequenceID===active.sequenceID){owners.push(p);if(activeNode&&s.projectItem&&String(s.projectItem.nodeId)===activeNode)exact.push(p);}
            }
        }
        if(exact.length===1)return exact[0];
        if(owners.length===1)return owners[0];
        throw new Error('Не удалось однозначно определить проект активного эпизода. Закройте лишнюю копию проекта и повторите.');
    }
    function fingerprint(s,audioOnly) {
        var data=audioOnly?[String(s.timebase),String(s.zeroPoint)]:[String(s.end),String(s.timebase),String(s.zeroPoint)];
        var groups=audioOnly?[s.audioTracks]:[s.audioTracks,s.videoTracks];
        for(var g=0;g<groups.length;g++) {
            var tracks=groups[g];
            data.push(tracks.numTracks);
            for(var t=0;t<tracks.numTracks;t++) {
                var track=tracks[t];
                try{data.push(track.isMuted());}catch(e){data.push('unknown');}
                data.push(track.clips.numItems);
                for(var c=0;c<track.clips.numItems;c++) {
                    var clip=track.clips[c];
                    data.push([clip.nodeId,clip.projectItem ? clip.projectItem.nodeId : '',clip.start.ticks,clip.end.ticks,clip.inPoint.ticks,clip.outPoint.ticks,clip.disabled].join(':'));
                    try{data.push(clip.getSpeed(),clip.isSpeedReversed());}catch(ignore){}
                }
            }
        }
        return data.join('|');
    }
    function inspect(light) {
        var s=app.project ? app.project.activeSequence : null, p=project();
        if(!p.path) throw new Error('Сначала сохраните активный проект Premiere.');
        if(!s) throw new Error('Откройте нужный эпизод на таймлайне.');
        var settings=s.getSettings();
        return {projectPath:p.path, sequenceID:s.sequenceID, name:s.name, end:String(s.end), zeroPoint:String(s.zeroPoint), fingerprint:light ? null : fingerprint(s), audioFingerprint:light ? null : fingerprint(s,true), width:settings.videoFrameWidth, height:settings.videoFrameHeight, fps:254016000000/Number(s.timebase), duration:Number(s.end)/254016000000, playhead:s.getPlayerPosition().seconds, inPoint:s.getInPointAsTime().seconds, outPoint:s.getOutPointAsTime().seconds};
    }
    function resolve(context,audioOnly) {
        var p=project();
        if(!app.project.activeSequence || app.project.activeSequence.sequenceID!==context.sequenceID) throw new Error('Активный эпизод изменился. Результат сохранён; вернитесь к исходному эпизоду и повторите.');
        if(p.path!==context.projectPath) throw new Error('Откройте исходный проект для эпизода «'+context.name+'» и повторите добавление.');
        for(var i=0;i<p.sequences.numSequences;i++) {
            var s=p.sequences[i];
            if(s.sequenceID===context.sequenceID) {
                if(audioOnly&&context.audioFingerprint){if(fingerprint(s,true)!==context.audioFingerprint)throw new Error('Звуковой монтаж изменился. Распознайте обновлённую речь. Позиция курсора на проверку не влияет.');}else if(fingerprint(s)!==context.fingerprint) throw new Error('Монтаж эпизода изменился после распознавания. Распознайте обновлённую речь. Позиция курсора на проверку не влияет.');
                return s;
            }
        }
        throw new Error('Исходный эпизод больше не найден в проекте.');
    }
    function exportAudio(args) {
        var s=resolve(args.context,true), preset=new File(args.preset), target=new File(args.audio);
        if(!preset.exists) throw new Error('Не найден пресет экспорта звука.');
        if(target.exists) throw new Error('Служебный аудиофайл уже существует.');
        if(args.scope==='inout' && (Math.abs(s.getInPointAsTime().seconds-args.offset)>.001 || Math.abs(s.getOutPointAsTime().seconds-args.rangeEnd)>.001)) throw new Error('Точки In / Out изменились. Повторите распознавание.');
        s.exportAsMediaDirect(target.fsName,preset.fsName,args.scope==='inout'?1:0);
        target=new File(args.audio);
        if(!target.exists || target.length<44) throw new Error('Premiere не создал звук эпизода. Возможно, экспорт был отменён.');
        return {audio:target.fsName,bytes:target.length};
    }
    function findMedia(bin,path) {
        for(var i=0;i<bin.children.numItems;i++) {
            var item=bin.children[i];
            if(item.type===2) {var found=findMedia(item,path); if(found)return found;}
            else {try{if(new File(item.getMediaPath()).fsName.toLowerCase()===path.toLowerCase())return item;}catch(e){}}
        }
        return null;
    }
    function addCaptions(args) {
        if(applied[args.jobId]) return {name:args.context.name,alreadyApplied:true};
        var s=resolve(args.context,true), p=project(), file=new File(args.srt);
        if(!file.exists) throw new Error('Не найден файл распознанных субтитров.');
        var bin=null;
        for(var i=0;i<p.rootItem.children.numItems;i++) {
            var item=p.rootItem.children[i];
            if(item.type===2 && item.name==='Русские субтитры') {bin=item;break;}
        }
        if(!bin) bin=p.rootItem.createBin('Русские субтитры');
        if(!bin) throw new Error('Не удалось создать папку субтитров в проекте.');
        var imported=findMedia(bin,file.fsName);
        if(!imported) {
            if(!p.importFiles([file.fsName],true,bin,false)) throw new Error('Premiere не смог импортировать субтитры.');
            imported=findMedia(bin,file.fsName);
        }
        if(!imported) throw new Error('Импортированный файл не найден в проекте.');
        if(!s.createCaptionTrack(imported,0)) throw new Error('Premiere не смог создать дорожку подписей.');
        applied[args.jobId]=true;
        return {name:s.name,sequenceID:s.sequenceID,importedNodeId:imported.nodeId};
    }
    function seconds(value){var t=new Time();t.seconds=value;return t;}
    function importMedia(path){
        var p=project(),file=new File(path);if(!file.exists)throw new Error('Не найден результат: '+path);
        var item=findMedia(p.rootItem,file.fsName);if(item)return item;
        var bin=null;for(var i=0;i<p.rootItem.children.numItems;i++){var b=p.rootItem.children[i];if(b.type===2&&b.name==='Русские субтитры'){bin=b;break;}}
        if(!bin)bin=p.rootItem.createBin('Русские субтитры');
        if(!p.importFiles([file.fsName],true,bin,false))throw new Error('Не удалось импортировать графику.');
        item=findMedia(bin,file.fsName);if(!item)throw new Error('Графика не найдена после импорта.');return item;
    }
    function emptyTrack(s){
        var highest=-1;for(var t=0;t<s.videoTracks.numTracks;t++)if(s.videoTracks[t].clips.numItems>0)highest=t;
        for(var i=highest+1;i<s.videoTracks.numTracks;i++)if(s.videoTracks[i].clips.numItems===0)return i;
        throw new Error('Добавьте пустую видеодорожку над видео и повторите.');
    }
    function addOverlay(args){
        var s=resolve(args.context),item=importMedia(args.path),trackIndex=-1,old=null;
        if(args.previous){
            for(var t=0;t<s.videoTracks.numTracks;t++)for(var c=0;c<s.videoTracks[t].clips.numItems;c++){
                var clip=s.videoTracks[t].clips[c];
                if(clip.nodeId===args.previous.nodeId){
                    if(new File(clip.projectItem.getMediaPath()).fsName.toLowerCase()!==new File(args.previous.path).fsName.toLowerCase())throw new Error('Предыдущая графика была заменена вручную.');
                    if(Math.abs(clip.start.seconds-args.previous.start)>.04||Math.abs(clip.end.seconds-args.previous.end)>.04)throw new Error('Предыдущая графика обрезана или перемещена. Создайте новый результат.');
                    if(s.videoTracks[t].clips.numItems!==1)throw new Error('На дорожке появились другие клипы. Для обновления оставьте на ней только нашу графику.');
                    trackIndex=t;old=clip;
                }
            }
            if(!old)throw new Error('Предыдущая графика удалена. Начните новое распознавание или создайте титр.');
        }
        if(trackIndex<0)trackIndex=emptyTrack(s);
        var oldItem=old?old.projectItem:null,oldStart=old?old.start.seconds:0,oldEnd=old?old.end.seconds:0;
        if(old)old.remove(false,true);
        try{
            s.videoTracks[trackIndex].overwriteClip(item,args.start);
            var created=null;for(var j=0;j<s.videoTracks[trackIndex].clips.numItems;j++){var candidate=s.videoTracks[trackIndex].clips[j];if(candidate.projectItem.nodeId===item.nodeId){created=candidate;break;}}
            if(!created)throw new Error('Premiere не добавил графику на дорожку.');
            created.end=seconds(args.end);
            return {name:s.name,nodeId:created.nodeId,path:args.path,start:created.start.seconds,end:created.end.seconds,fingerprint:fingerprint(s),track:trackIndex+1};
        }catch(e){if(created){try{created.remove(false,true);}catch(ignore){}}if(oldItem){s.videoTracks[trackIndex].overwriteClip(oldItem,oldStart);var restored=s.videoTracks[trackIndex].clips[0];restored.end=seconds(oldEnd);}throw e;}
    }
    function addMogrts(args){
        var s=resolve(args.context),trackIndex=emptyTrack(s),created=[];
        var audioIndex=-1;for(var ai=s.audioTracks.numTracks-1;ai>=0;ai--)if(s.audioTracks[ai].clips.numItems===0){audioIndex=ai;break;}
        if(audioIndex<0)throw new Error('Для безопасной вставки MOGRT добавьте пустую звуковую дорожку.');
        try{
            for(var i=0;i<args.captions.length;i++){
                var cap=args.captions[i],clip=s.importMGT(new File(args.path).fsName,seconds(cap.start).ticks,trackIndex,audioIndex);
                if(!clip)throw new Error('Шаблон не удалось импортировать.');created.push(clip);
                var comp=clip.getMGTComponent();if(!comp)throw new Error('Шаблон не предоставляет доступных полей.');
                var param=null;
                if(args.field.index!==undefined && args.field.index<comp.properties.numItems){var indexed=comp.properties[args.field.index];if(indexed.displayName===args.field.name && /"textEditValue"\s*:/.test(String(indexed.getValue())))param=indexed;}
                if(!param){var matches=[];for(var j=0;j<comp.properties.numItems;j++){var p=comp.properties[j];if(p.displayName===args.field.name && /"textEditValue"\s*:/.test(String(p.getValue())))matches.push(p);}if(matches.length===1)param=matches[0];}
                if(!param)throw new Error('Не найдено выбранное текстовое поле MOGRT.');
                var value=param.getValue();
                if(typeof value==='string'&&/"textEditValue"\s*:/.test(value)){
                    value=value.replace(/("textEditValue"\s*:\s*)"(?:\\.|[^"\\])*"/,function(all,prefix){return prefix+stringify(cap.text);});
                    value=value.replace(/("fontTextRunLength"\s*:\s*)\[[^\]]*\]/,'$1['+cap.text.length+']');
                    value=value.replace(/("capPropTextRunCount"\s*:\s*)\d+/,function(all,prefix){return prefix+'1';});
                    if(args.letterCase && args.letterCase!=='original'){
                        value=value.replace(/("fontFSAllCapsValue"\s*:\s*)\[[^\]]*\]/,'$1[false]');
                        value=value.replace(/("fontFSSmallCapsValue"\s*:\s*)\[[^\]]*\]/,'$1[false]');
                    }
                }else value=cap.text;
                param.setValue(value,true);clip.end=seconds(cap.end);
            }
            return {name:s.name,count:created.length,track:trackIndex+1,fingerprint:fingerprint(s)};
        }catch(e){for(var k=created.length-1;k>=0;k--){try{created[k].remove(false,true);}catch(ignore){}}for(var ac=s.audioTracks[audioIndex].clips.numItems-1;ac>=0;ac--){try{s.audioTracks[audioIndex].clips[ac].remove(false,true);}catch(ignoreAudio){}}throw e;}
    }
    return {dispatch:function(method,args) {
        try {
            var result;
            if(method==='inspect') result=inspect(false);
            else if(method==='target') result=inspect(true);
            else if(method==='export') result=exportAudio(args);
            else if(method==='apply') result=addCaptions(args);
            else if(method==='overlay') result=addOverlay(args);
            else if(method==='mogrts') result=addMogrts(args);
            else if(method==='chooseMogrt'){var chosen=File.openDialog('Выберите текстовый MOGRT','Motion Graphics Templates:*.mogrt',false);result=chosen?chosen.fsName:null;}
            else if(method==='seek'){var seq=resolve(args.context);seq.setPlayerPosition(seconds(args.time).ticks);result=true;}
            else throw new Error('Неизвестная операция.');
            return stringify({ok:true,result:result});
        } catch(e) {return stringify({ok:false,error:String(e.message||e),line:e.line||0});}
    }};
}());
