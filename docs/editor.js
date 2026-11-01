'use strict';
(() => {
  const stageFiles=['00-starter','01-movement','02-enemies','03-health','04-attack','05-survivor','06-projectiles','07-experience','08-upgrades'];
  const status=document.getElementById('editor-status');
  const stage=document.getElementById('project-stage');
  const practice=document.getElementById('practice-mode');
  practice.checked=new URLSearchParams(location.search).get('practice')==='1';
  const fileInput=document.getElementById('local-project');
  const artworkInput=document.getElementById('local-artwork');
  let currentName='나의 생존 게임', ready=false, objectUrls=[], artworkMode='object';
  const encoder=new TextEncoder(), decoder=new TextDecoder();
  const message=(text,error=false)=>{status.textContent=text;status.classList.toggle('error',error);};
  const busy=(state)=>document.querySelectorAll('.lab-toolbar button').forEach(button=>button.disabled=state);
  const safeName=name=>String(name||'entry-project').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').slice(0,80);
  function useLocalCollisionWalls(){
    // The upstream wall bitmap is sampled by getImageData during bounce_wall.
    // Loading that bitmap from the CDN without CORS taints the collision canvas.
    // Retain the upstream wall geometry/algorithm and use its original local bitmap.
    const initWall=Entry.Stage.prototype.initWall;
    Entry.Stage.prototype.initWall=function(...args){
      const previous=Entry.mediaFilePath;
      try{Entry.mediaFilePath=new URL('assets/entry-runtime/',location.href).href;return initWall.apply(this,args);}
      finally{Entry.mediaFilePath=previous;}
    };
  }
  const save=(bytes,name,type)=>{
    const blob=bytes instanceof Blob?bytes:new Blob([bytes],{type});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  };
  function rewriteLocalMedia(project) {
    for(const object of project.objects||[])for(const picture of object.sprite?.pictures||[]) {
      const name=(picture.fileurl||'').split('/').pop();
      if((picture.fileurl||'').startsWith('temp/'))picture.fileurl='assets/game/'+name;
      if((picture.thumbUrl||'').startsWith('temp/'))picture.thumbUrl=picture.fileurl;
    }
    return project;
  }
  async function loadProject(project,name){
    if(!project||!Array.isArray(project.objects)||!project.objects.length)throw new Error('오브젝트가 있는 엔트리 프로젝트 파일을 선택해 주세요.');
    if(Entry.engine&&!Entry.engine.isState('stop'))await Entry.engine.toggleStop();
    Entry.clearProject();
    Entry.loadProject(project);
    if(project.objects.some(object=>object.id==='player'))Entry.container.selectObject('player');
    Entry.resizeElement({canvasWidth:400,menuWidth:264});
    currentName=name||project.name||'나의 생존 게임';
    message(currentName+' · 초록색 시작 버튼으로 실행하세요.');
    document.title=currentName+' · 엔트리 실습 편집기';
  }
  async function loadStage(){
    busy(true);
    try{
      const name=stageFiles[Number(stage.value)];
      const response=await fetch('downloads/'+(practice.checked&&Number(stage.value)>0?'practice/'+name+'-practice':name)+'.json');
      if(!response.ok)throw new Error('단계 파일을 불러오지 못했습니다.');
      const project=rewriteLocalMedia(await response.json());
      await loadProject(project,project.name);
      const targets=['플레이어','플레이어','적','적','자동 공격 범위','플레이어','자동 관통탄','적과 경험치','플레이어'];
      const target=project.objects.find(object=>object.name===targets[Number(stage.value)]);
      if(practice.checked&&target)Entry.container.selectObject(target.id);
      document.querySelector('.lab-header .back').href='index.html#build/'+stage.value;
    }catch(error){console.error(error);message(error.message,true);}finally{busy(false);}
  }
  function parseTar(bytes){
    const files=new Map();
    for(let offset=0;offset+512<=bytes.length;){
      const header=bytes.subarray(offset,offset+512);
      if(header.every(value=>value===0))break;
      const string=(start,length)=>decoder.decode(header.subarray(start,start+length)).split('\0')[0];
      const name=string(0,100),prefix=string(345,155),size=parseInt(string(124,12).trim()||'0',8);
      if(!Number.isFinite(size)||size<0||offset+512+size>bytes.length)throw new Error('압축 파일의 구조를 읽을 수 없습니다.');
      const full=(prefix?prefix+'/':'')+name;
      if(header[156]===0||header[156]===48)files.set(full.replace(/^\.\//,''),bytes.slice(offset+512,offset+512+size));
      offset+=512+Math.ceil(size/512)*512;
    }
    return files;
  }
  function mediaType(name){return /\.svg$/i.test(name)?'image/svg+xml':/\.png$/i.test(name)?'image/png':/\.jpe?g$/i.test(name)?'image/jpeg':/\.mp3$/i.test(name)?'audio/mpeg':'application/octet-stream';}
  async function imageModel(file){
    const url=URL.createObjectURL(file);objectUrls.push(url);
    const image=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('이미지 파일을 읽을 수 없습니다.'));image.src=url;});
    return {id:Entry.generateHash(),name:file.name.replace(/\.[^.]+$/,''),
      fileurl:url,thumbUrl:url,imageType:file.type.includes('svg')?'svg':'png',
      dimension:{width:image.naturalWidth,height:image.naturalHeight}};
  }
  function openArtwork(mode){artworkMode=mode;artworkInput.click();}
  artworkInput.addEventListener('change',async()=>{
    const file=artworkInput.files[0];if(!file)return;
    try{
      const picture=await imageModel(file);
      if(artworkMode==='picture'){
        if(!Entry.playground.object)throw new Error('모양을 추가할 오브젝트를 먼저 선택해 주세요.');
        Entry.playground.addPicture(picture,true);
      }else{
        const {width,height}=picture.dimension,scale=70/Math.max(width,height);
        Entry.container.addObject({id:Entry.generateHash(),name:picture.name,objectType:'sprite',rotateMethod:'none',
          script:'[]',selectedPictureId:picture.id,sprite:{pictures:[picture],sounds:[]},
          entity:{x:0,y:0,regX:width/2,regY:height/2,scaleX:scale,scaleY:scale,rotation:0,direction:90,width,height,visible:true}});
      }
      message('이미지를 추가했습니다. 파일은 이 브라우저에서만 처리됩니다.');
    }catch(error){console.error(error);message(error.message,true);}finally{artworkInput.value='';}
  });
  async function savePaintedImage(data){
    try{
      const response=await fetch(data.image),blob=await response.blob();
      const file=new File([blob],data.file.name+'.png',{type:'image/png'}),picture=await imageModel(file);
      picture.objectId=data.file.objectId;
      if(data.file.mode==='new')Entry.playground.addPicture(picture,true);
      else{
        picture.id=data.file.id;picture.name=data.file.name;
        Entry.playground.setPicture(picture);
        const image=new Image();image.onload=()=>{
          Entry.container.cachePicture(picture.id+Entry.playground.object.entity.id,image);
          Entry.playground.selectPicture(picture);
        };image.src=picture.fileurl;
      }
      message('그린 모양을 적용했습니다. .ent 파일로 저장해 주세요.');
    }catch(error){console.error(error);message(error.message,true);}
  }
  async function readEnt(file){
    if(!window.DecompressionStream)throw new Error('이 브라우저는 .ent 열기를 지원하지 않습니다. 최신 Chrome/Edge 또는 JSON 백업을 사용하세요.');
    const raw=new Uint8Array(await new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    const files=parseTar(raw),projectData=files.get('temp/project.json');
    if(!projectData)throw new Error('이 파일에서 temp/project.json을 찾지 못했습니다.');
    const project=JSON.parse(decoder.decode(projectData));
    const makeUrl=path=>{
      const normalized=String(path||'').replace(/\\/g,'/').replace(/^\.\//,'');
      const data=files.get(normalized);
      if(!data)return path;
      const url=URL.createObjectURL(new Blob([data],{type:mediaType(path)}));objectUrls.push(url);return url;
    };
    for(const object of project.objects||[]){
      for(const picture of object.sprite?.pictures||[]){
        const filename=picture.filename||'';
        const fallback='temp/'+filename.slice(0,2)+'/'+filename.slice(2,4)+'/image/'+filename+'.png';
        picture.fileurl=makeUrl(picture.fileurl||fallback);picture.thumbUrl=picture.fileurl;
      }
      for(const sound of object.sprite?.sounds||[])sound.fileurl=makeUrl(sound.fileurl);
    }
    return project;
  }
  function tarEntry(name,data){
    const header=new Uint8Array(512);
    const field=(offset,length,text)=>header.set(encoder.encode(text).subarray(0,length),offset);
    const octal=(value,length)=>value.toString(8).padStart(length-1,'0')+'\0';
    field(0,100,name);field(100,8,'0000644\0');field(108,8,'0000000\0');field(116,8,'0000000\0');
    field(124,12,octal(data.length,12));field(136,12,'00000000000\0');header.fill(32,148,156);
    field(156,1,'0');field(257,6,'ustar\0');field(263,2,'00');
    let sum=0;header.forEach(value=>sum+=value);field(148,8,sum.toString(8).padStart(6,'0')+'\0 ');
    const entry=new Uint8Array(512+Math.ceil(data.length/512)*512);entry.set(header);entry.set(data,512);return entry;
  }
  async function snapshot(){
    if(!ready)throw new Error('편집기가 아직 준비되지 않았습니다.');
    if(!Entry.engine.isState('stop'))await Entry.engine.toggleStop();
    const project=Entry.exportProject({name:currentName});
    if(!project)throw new Error('저장할 오브젝트가 없습니다.');
    return project;
  }
  async function pngBlob(blob,maxEdge=Infinity){
    const url=URL.createObjectURL(blob);
    try{
      const image=await new Promise((resolve,reject)=>{
        const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('이미지를 읽지 못했습니다.'));image.src=url;
      });
      const scale=Math.min(1,maxEdge/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      return await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('이미지 저장에 실패했습니다.')),'image/png'));
    }finally{URL.revokeObjectURL(url);}
  }
  async function mediaHash(bytes){
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(digest)).map(value=>value.toString(16).padStart(2,'0')).join('').slice(0,32);
  }
  async function packEnt(project){
    if(!window.CompressionStream)throw new Error('이 브라우저는 .ent 저장을 지원하지 않습니다. JSON 백업을 사용하세요.');
    const files=new Map();
    for(const object of project.objects||[]){
      for(const picture of object.sprite?.pictures||[]){
        const response=await fetch(picture.fileurl);if(!response.ok)throw new Error('이미지를 저장하지 못했습니다: '+picture.name);
        let blob=await response.blob();
        if(picture.imageType==='svg'||blob.type.includes('svg'))blob=await pngBlob(blob);
        const bytes=new Uint8Array(await blob.arrayBuffer()),filename=await mediaHash(bytes);
        const prefix='temp/'+filename.slice(0,2)+'/'+filename.slice(2,4);
        files.set(prefix+'/image/'+filename+'.png',bytes);
        files.set(prefix+'/thumb/'+filename+'.png',new Uint8Array(await (await pngBlob(blob,96)).arrayBuffer()));
        picture.filename=filename;picture.imageType='png';picture.ext='.png';
        delete picture.fileurl;delete picture.thumbUrl;
      }
      for(const sound of object.sprite?.sounds||[]){
        const response=await fetch(sound.fileurl);if(!response.ok)throw new Error('소리를 저장하지 못했습니다: '+sound.name);
        const bytes=new Uint8Array(await response.arrayBuffer()),filename=await mediaHash(bytes);
        const ext=sound.ext||'.mp3',prefix='temp/'+filename.slice(0,2)+'/'+filename.slice(2,4);
        files.set(prefix+'/sound/'+filename+ext,bytes);sound.filename=filename;delete sound.fileurl;
      }
    }
    const entries=Array.from(files,([name,data])=>tarEntry(name,data));
    entries.unshift(tarEntry('temp/project.json',encoder.encode(JSON.stringify(project))));entries.push(new Uint8Array(1024));
    return await new Response(new Blob(entries).stream().pipeThrough(new CompressionStream('gzip'))).blob();
  }
  const stageConfirm=document.getElementById('stage-confirm');
  document.getElementById('load-stage').addEventListener('click',()=>stageConfirm.showModal());
  document.getElementById('cancel-stage').addEventListener('click',()=>{stageConfirm.close();document.getElementById('save-ent').focus();});
  document.getElementById('confirm-stage').addEventListener('click',()=>{stageConfirm.close();loadStage();});
  document.getElementById('open-local').addEventListener('click',()=>fileInput.click());
  fileInput.addEventListener('change',async()=>{
    const file=fileInput.files[0];if(!file)return;busy(true);
    try{
      const project=/\.ent$/i.test(file.name)?await readEnt(file):JSON.parse(await file.text());
      await loadProject(project,project.name||file.name.replace(/\.(ent|json)$/i,''));
      const matched=/^0([0-8])\s/.exec(project.name||file.name);
      if(matched)stage.value=String(Number(matched[1]));
      document.querySelector('.lab-header .back').href=matched?'index.html#build/'+stage.value:'index.html#project';
    }
    catch(error){console.error(error);message(error.message,true);}finally{fileInput.value='';busy(false);}
  });
  document.getElementById('save-ent').addEventListener('click',async()=>{
    busy(true);message('프로젝트와 이미지를 .ent 파일로 묶는 중입니다…');
    try{const project=await snapshot();save(await packEnt(project),safeName(currentName)+'.ent','application/octet-stream');message('.ent 파일을 저장했습니다. 공식 엔트리에서는 로그인 후 불러올 수 있어요.');}
    catch(error){console.error(error);message(error.message,true);}finally{busy(false);}
  });
  document.getElementById('save-json').addEventListener('click',async()=>{
    busy(true);
    try{
      const project=await snapshot();
      for(const object of project.objects||[])for(const picture of object.sprite?.pictures||[]){
        const response=await fetch(picture.fileurl),blob=await response.blob();
        const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
        picture.fileurl=url;picture.thumbUrl=url;
      }
      save(JSON.stringify(project,null,2),safeName(currentName)+'.json','application/json');message('이미지가 포함된 JSON 백업을 저장했습니다. 이 편집기의 내 파일 열기로 복원하세요.');
    }catch(error){console.error(error);message(error.message,true);}finally{busy(false);}
  });
  async function boot(){
    try{
      if(!window.Entry)throw new Error('공식 EntryJS 파일을 불러오지 못했습니다. 인터넷 연결 후 새로고침해 주세요.');
      document.getElementById('editor-boot').remove();
      Entry.creationChangedEvent=new Entry.Event(window);
      useLocalCollisionWalls();
      Entry.init(document.getElementById('workspace'),{
        type:'workspace',libDir:'https://playentry.org/lib',entryDir:'/entry-js',
        baseUrl:'https://playentry.org',textCodingEnable:false,hardwareEnable:false,
        dataTableEnable:false,aiLearningEnable:false,backpackDisable:true,
        fonts:[{name:'맑은 고딕',family:'Malgun Gothic',url:''}],
      });
      Entry.addEventListener('openSpriteManager',()=>openArtwork('object'));
      Entry.addEventListener('openPictureManager',()=>openArtwork('picture'));
      Entry.addEventListener('openPictureImport',()=>openArtwork('picture'));
      Entry.addEventListener('saveCanvasImage',savePaintedImage);
      Entry.addEventListener('openSoundManager',()=>message('소리 자료 검색과 확장 도구는 공식 엔트리에서 이용해 주세요. 이 편집기는 게임 제작의 핵심 블록과 이미지 실습을 지원합니다.'));
      ready=true;
      const value=Number(new URLSearchParams(location.search).get('step')??8);
      stage.value=String(Number.isInteger(value)&&value>=0&&value<=8?value:8);
      await loadStage();
    }catch(error){console.error(error);message(error.message,true);const boot=document.getElementById('editor-boot');if(boot)boot.querySelector('p').textContent=error.message;}
  }
  boot();
})();
