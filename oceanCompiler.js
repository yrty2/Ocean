const blueocean={
    version:1.0,
    opcode:["print","as","in","is","where"],
    tokenizer(code){
        function pushAt(u,t,v){
        return [...u.slice(0,t+1),v,...u.slice(t+1,u.length)];
        }
        function In(a,u){
            return u.findIndex(e=>JSON.stringify(e)==JSON.stringify(a))!=-1;
        }
        let tokens=[];
        let token=[];
        var tape="";
        function cut(){
            if(tape.length>0){
                token.push(tape);
            }
            tape="";
        }
        function add(value){
            token.push(value);
        }
        var reading=0;
        const opcode=blueocean.opcode;//x as 1+2 in H
        //types i32_u->N i32_s->Z f32->R f32,f32->C v128.f32x4->H
        //const x:[type]=[Number]->define x as [Number] in [type]
        //let x:[type]=[Number]->where x is [Number] in [type]
        //省略記法 whr x=[Number] in [type]
        const operators=["+","-","*","/","^","!","~","%","=","・","°",",","$","'",":",">","<"];
        const splitter=[";","\n"];
        const uoperator=["~","°","$"];
        //課題：冪演算が乗算と同じ優先度になっている。
        //優先度　階乗>>冪乗>>乗算>>加算>>符号
        var startpoint=true;
        let inabs=false;
        for(let k=0; k<code.length; ++k){
            var safe=true;//テープに記述するか
            const word=code[k];
            if(word=="(" || word==")"){
                reading=0;
                startpoint=(word=="(");
                //カッコだった。
                cut();
                add(word);
                safe=false;
            }
            if(word=="{" || word=="}"){
                reading=0;
                startpoint=(word=="{");
                //カッコだった。
                cut();
                add(word);
                safe=false;
            }
            if(In(tape,opcode)){
                cut();
            }
            if(/^[a-zA-Z]+$/.test(word) && reading==0){
                //変数または関数
                reading=1;
                cut();
            }
            if(word=="|"){
                //絶対値記号だった。
                cut();
                add(word);
                inabs=!inabs;
                safe=false;
            }
            if(In(word,operators)){
                reading=0;
                if(startpoint && (word=="+" || word=="-")){
                    cut();
                    if(word=="-"){
                    add("-1");
                    add("*");
                    }
                    safe=false;
                }else{
                cut();
                if(k+1<code.length && In(code[k+1],operators)){
                    let op=word;
                    let uop=In(word,uoperator);
                    let fact=word=="!";//uopなら階乗でない限り重ならない。例えば6!!
                    while(!uop && k+1<code.length && In(code[k+1],operators)){
                        if(!fact || code[k+1]=="!"){
                            k++;
                            op+=code[k];
                        }else{
                            break;
                        }
                    }
                    if(op=="//"){
                        tape="";
                        while(k<code.length){
                            if(code[k]=="\n"){
                                break;
                            }
                            k++;
                        }
                    }else{
                        add(op);
                    }
                }else{
                    add(word);
                }
                safe=false;
                }
            }
            if(In(word,splitter)){
                reading=0;
                cut();
                safe=false;
            }
            if(word==" "){
                reading=0;
                cut();
                safe=false;
            }
            if(safe){
            tape+=word;
            }
            if(word!="(" && word!="{"){
                startpoint=false;
            }
            if(inabs && word=="|"){
                startpoint=true;
            }
            if(word==":"){
                startpoint=true;
            }
            if(In(word,splitter)){
                if(token.length>0){
                tokens.push(token);
                token=[];
                }
                startpoint=true;
            }
        }
        cut();
        if(token.length>0){
        tokens.push(token);
        }
        for(let i=0; i<tokens.length; ++i){
            for(let k=0; k<tokens[i].length; ++k){
                if(k+1<tokens[i].length){
                    var now=tokens[i][k];
                    var next=tokens[i][k+1];
                    if(now==")" && next=="("){
                        tokens[i]=pushAt(tokens[i],k,"*");
                    }
                    if(now==")" && (!isNaN(next) || (/^[a-zA-Z]+$/.test(next) && !In(next,opcode)))){
                        tokens[i]=pushAt(tokens[i],k,"*");
                    }
                    if(!isNaN(now) && (next=="(" || /^[a-zA-Z]+$/.test(next) && !In(next,opcode))){
                        tokens[i]=pushAt(tokens[i],k,"*");
                    }
                }
            }
        }
        return tokens;
    },
    parser(tokens){
        let locals=[];
        let token;
        let pos=0;
        function guess(left,right){
            const L=left=="guess";
            const R=right=="guess";
            if(L && R){
                return "guess";
            }
            if(L && !R){
                return right;
            }
            if(!L && R){
                return left;
            }
            if(left==right){
                return left;
            }
            console.warn("違う型同士で演算を行うことはできません！");
        }
        function peek() {
            return token[pos];
        }
        function consume() {
            return token[pos++];
        }
        function expect(value) {
            if(peek()!==value){
                console.warn(`[ ${value} ]が見つかりません！`);
                if(value==":"){
                    console.warn("どの条件にも入らない場合は{~,otherwise:~}と書いてください");
                }
                midori.errored=true;
            }
            consume();
        }
        function parseExpression(){
            if(!blueocean.errored){
                let In;
            if(peek()=="|"){
                In="|";
            }
            let node=parseTerm();
                node.in=In;
            while(peek()==="+" || peek()==="-"){
                //+か-であるなら。
                const operator=consume();
                const right=parseTerm();
                node={type:"BinaryExpression",operator,left: node,right,group:guess(node.group,right.group)};
            }
            if(!node){
                console.warn(`カッコの中身がありません！`);
                blueocean.errored=true;
                return;
            }
            return node;
            }
        }
        function parseTerm(){
            let node=parseDeepTerm();
            while(peek()==="*" || peek()==="/" || peek()==="・"){
                const operator=consume();
                const right=parseDeepTerm();
                node={type:"BinaryExpression",operator,left:node,right,group:guess(node.group,right.group)};
            }
            return node;
        }
        function parseDeepTerm(){
            let node=parsePrimary();
            while(peek()==="^" || peek()==="^^" || peek()==="**" || peek()==="****" || peek()==="%" || peek()===">" || peek()==="<" || peek()==="=" || peek()==="==" || peek()==="<=" || peek()===">=" || peek()==="=/"){
                let operator=consume();
                const right=parsePrimary();
                node={type:"BinaryExpression",operator:operator,left:node,right,group:guess(node.group,right.group)};
            }
            return node;
        }
        function findRightUnary(value){
            if(peek()==="$" || peek()==="!" || peek()==="~" || peek==="°"){
                var operator=peek();
                consume();
                return {type:"UnaryExpression",operator:operator,value:value,group:value.group};
            }
            if(peek() && peek().indexOf("!!")!=-1){
                let am=peek().length;
                consume();
                return {type:"UnaryExpression",operator:"multiFactorial",amount:am,value:value,group:value.group};
            }
            return value;
        }
        function parsePrimary(){
            const t = peek();
            //実数か？
            if(!isNaN(t)){
                consume();
                return findRightUnary({type:"Literal",value:Number(t),group:"guess"});
            }
            if(blueocean.opcode.indexOf(peek())!=-1){
                const op=consume();
                //オペレーション
                if(op==="print"){
                    const arg=parseExpression();
                    return {type:"print",argument:arg,group:arg.group};
                }
                if(op==="where"){
                    //where [name] is [literal] in [type]
                    //where pi is 3.14 in R
                    //変数宣言
                    const name=consume();
                    expect("is");
                    const value=parseExpression();
                    expect("in");
                    const type=consume();
                    locals.push({name:name,group:type});
                    return {type:"decl",name:name,value:value,group:type};
                }
            }
            //数字でない場合
            if(/^[a-zA-Z-.-0-1-2-3-4-5-6-7-8-9]+$/.test(t)){
                const name = consume();
                //関数呼出しか？
                if(peek()==="(" || peek()==="'"){
                    let derivate=0;
                    while(peek()==="'"){
                        consume();
                        derivate++;
                    }
                    consume();
                    let argument=[];
                    while(true){
                        //()の中身がない場合もある。そのばあい(void)
                    if(peek()==="void"){
                        consume();
                    }else{
                    argument.push(parseExpression());
                    }
                        if(peek()!==","){
                            break;
                        }
                        consume();
                    }
                    expect(")");
                    return findRightUnary({type:"CallExpression",callee:{type:"Identifier",name},arguments:argument,derivate:derivate,group:argument[0].group});
                }
                //関数でないなら変数
                if(name===undefined){
                console.warn(`構文エラー：二項演算の右辺が入力されていません。`);
                blueocean.errored=true;
                }
                let gn=locals.findIndex(e=>e.name==name);
                if(name=="i"){
                    gn="C";
                }else if(gn!=-1){
                    gn=locals[gn].group;
                }else{
                    gn="guess"
                }
                return findRightUnary({type:"Identifier",name,group:gn});
            }
            //カッコなら
            if(t==="("){
                consume();
                const nodes=[];
                while(true){
                nodes.push(parseExpression());
                    if(peek()!==","){
                        break;
                    }else{
                        consume();
                    }
                }
                expect(")");
                if(nodes.length<=1){
                    return findRightUnary(nodes[0]);
                }else{
                    for(let k=0; k<nodes.length; ++k){
                        nodes[k]=findRightUnary(nodes[k]);
                    }
                    //加群
                    return {value:nodes,type:"Vector",dimention:nodes.length};
                }
            }
            //区分線形関数
            if(t==="{"){
                consume();
                const nodes=[];
                while(true){
                    let node={conditions:{},res:{}};
                    node.conditions=findRightUnary(parseExpression());
                    expect(":");
                    node.res=findRightUnary(parseExpression());
                    nodes.push(node);
                    if(peek()!==","){
                        break;
                    }else{
                        consume();
                    }
                }
                expect("}");
                return {tree:nodes,type:"PiecewiseExpression"};
            }
            //絶対値記号
            if(t==="|"){
                consume();
                const node = parseExpression(t);
                expect("|");
                return findRightUnary(node);
            }
            console.warn(`構文エラー:${t}が理解できません。`);
            blueocean.errored=true;
            if(t=="-"){
                console.warn(`おそらく[x*-y]のようにしていませんか？\n正しいスペル[x*(-y)]`);
            }
        }
        const ast=[];
        for(let k=0; k<tokens.length; ++k){
            token=tokens[k].slice();
            ast.push(parseExpression());
            pos=0;
        if(blueocean.errored){
            blueocean.errored=false;
            return "errorDetected";
        }
        }
        return ast;
    },
    parsedocean(code){
        return this.parser(this.tokenizer(code));
    },
    errored:false,
    wasmStack:[],
    wasmer(midoricode){
        function ieee754(value,bytelength){
            if(!bytelength){
                bytelength=8;
            }
            if(value==0){
                return [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00];
            }
            let bit=[];
            let bytes=[];
            let ex=1023;
            bit.push((-Math.sign(value)+1)/2);//0,1,head
            value=Math.abs(value);
            while(value>=2){
                value*=1/2;
                ex++;
            }
            while(1>value){
                value*=2;
                ex--;
            }
            let binary=value.toString(2).slice(2);
            let exp=ex.toString(2);//指数部
            let K=0;
            for(let k=0; k<11; ++k){
                if(exp.length>=11-k){
                    bit.push(exp[K]);
                    K++;
                }else{
                    bit.push("0");
                }
            }
            for(let k=0; k<52; ++k){
                if(binary.length>k){
                    bit.push(binary[k]);
                }else{
                    bit.push("0");
                }
            }
            for(let k=7; k>=0; --k){
                bytes.push(parseInt(bit[8*k]+bit[8*k+1]+bit[8*k+2]+bit[8*k+3]+bit[8*k+4]+bit[8*k+5]+bit[8*k+6]+bit[8*k+7],2));
            }
            return bytes;
        }
        function UTFer(string){
            return new TextEncoder().encode(string);
        }
        function leb128_u(intger){
            let bin=intger.toString(2);
            let lop=7-bin.length%7;
            if(lop==7){
                lop=0;
            }
            for(let k=0; k<lop; ++k){
                bin="0"+bin;
            }
            const sp=Math.floor(bin.length/7);
            const bytes=[];
            for(let k=0; k<sp; ++k){
                if(k==0){
                bytes.push(0);
                }else{
                bytes.push(1);
                }
                for(let i=0; i<7; ++i){
                    bytes[k]+=bin[i+7*k];
                }
            }
            const res=[];
            for(let k=0; k<bytes.length; ++k){
                res.push(parseInt(bytes[bytes.length-k-1],2));
            }
            return res;
        }
        function leb128(intger){
        }
        const asts=blueocean.parsedocean(midoricode);
        //javascriptに合わせて全て倍精度計算にするよう変更。
        const f32={
            const:0x43,
            add:0x92,
            sub:0x93,
            mul:0x94,
            div:0x95,
            floor:0x8e,
            abs:0x8b,
            sqrt:0x91,
            lt:0x5d,
            le:0x5f,
            gt:0x5e,
            ge:0x60,
            eq:0x5b,
            ne:0x5c,
            ceil:0x8d,
            promote:0xbb
        }
        const f64={
            const:0x44,
            add:0xa0,
            sub:0xa1,
            mul:0xa2,
            div:0xa3,
            floor:0x9c,
            abs:0x99,
            sqrt:0x9f,
            lt:0x63,
            le:0x65,
            gt:0x64,
            ge:0x66,
            eq:0x61,
            ne:0x62,
            neg:0x9a,
            ceil:0x9b,
            demote:0xb6
        }
        const i32={
            const:0x41
        }
        const i64={
            const:0x42,
            add:0x7c,
            sub:0x7d,
            mul:0x7e,
            div_u:0x7f,
            div_s:0x80
        }
        const local={
            get:0x20,
            set:0x21,
            f64:0,
            f32:0,
            i64:0,
            i32:0,
            v128:0
        }
        const op={
            v128:0x7b,
            f64:0x7c,
            i64:0x7e,
            f32:0x7d,
            i32:0x7f,
            end:0x0b,
            else:0x05,
            if:0x04,
            block:0x02,
            br_if:0x0d,
            br:0x0c,
            void:0x40,
            loop:0x03,
            call:0x10,
            simd:0xfd
        }
        const v128={
            const:[0xfd,0x0c],
        }
        const f64x2={
            extract:[0xfd,0x21],
            replace:[0xfd,0x22],
            add:[0xfd,0xf0],
            sub:[0xfd,0xf1],
            mul:[0xfd,0xf2],
            div:[0xfd,0xf3],
            splat:[0xfd,0x14],
        }
        function localid(name){
            return localv[localv.findIndex(e=>e.name==name)].id;
        }
        function getid(){
            return local.i32+local.f32+local.i64+local.f64+local.v128-1;
        }
        const localv=[];
        //ループカウンター変数float32timer
        local.f64++;
        localv.push({name:"float64timer",group:"R",id:getid()});
        local.f64++;
        localv.push({name:"float64multiplier",group:"R",id:getid()});
        //計算用の変数
        local.f64++;
        localv.push({name:"float64x",group:"R",id:getid()});
        local.f64++;
        localv.push({name:"float64y",group:"R",id:getid()});
        local.f64++;
        localv.push({name:"float64z",group:"R",id:getid()});
        local.f64++;
        localv.push({name:"float64w",group:"R",id:getid()});
        local.f64++;
        localv.push({name:"float64timerz",group:"R",id:getid()});
        local.f64++;
        localv.push({name:"float64timerp",group:"R",id:getid()});
        local.f64++;
        localv.push({name:"float64holder",group:"R",id:getid()});
        local.f64++;
        localv.push({name:"float64holderp",group:"R",id:getid()});
        local.f64++;
        localv.push({name:"float64timera",group:"R",id:getid()});
        local.f64++;
        localv.push({name:"float64timers",group:"R",id:getid()});
        local.f64++;
        localv.push({name:"float64holdera",group:"R",id:getid()});
        local.f64++;
        localv.push({name:"float64holders",group:"R",id:getid()});
        local.f64++;
        localv.push({name:"float64u",group:"R",id:getid()});
        local.f64++;
        localv.push({name:"float64d",group:"R",id:getid()});
        local.f64++;
        localv.push({name:"float64v",group:"R",id:getid()});
        local.i64++;
        localv.push({name:"intger64b",group:"Z",id:getid()});
        local.v128++;
        localv.push({name:"complex128c",group:"C",id:getid()});
        local.v128++;
        localv.push({name:"complex128C",group:"C",id:getid()});
        local.v128++;
        localv.push({name:"complex128Z",group:"C",id:getid()});
        local.v128++;
        localv.push({name:"complex128W",group:"C",id:getid()});
        console.log(asts);
        const forp={
            x:localid("float64x"),
            y:localid("float64y"),
            z:localid("float64z"),
            w:localid("float64w"),
            holder:localid("float64holder"),
            holderp:localid("float64holderp"),
            timer:localid("float64timerz"),
            timerp:localid("float64timerp"),
            holdera:localid("float64holdera"),
            holders:localid("float64holders"),
            timera:localid("float64timera"),
            timers:localid("float64timers"),
            u:localid("float64u"),
            v:localid("float64v"),
            d:localid("float64d"),
            b:localid("intger64b"),
            c:localid("complex128c"),
            Z:localid("complex128Z"),
            C:localid("complex128C"),
            W:localid("complex128W")
        }
        function parseAST(kst,mother){
            function pi(){
                tape.push(f64.const,...ieee754(Math.PI));
            }
            function tau(){
                tape.push(f64.const,...ieee754(Math.PI/2));
            }
            function addLocal(name,init,group){
            if(group=="R"){
                local.f64++;
                localv.push({name:name,group:group,id:getid()});
                if(init!=0){
                tape.push(f64.const,...ieee754(init),local.set,getid());
                }
            }
            if(group=="Z"){
                local.i64++;
                localv.push({name:name,group:group,id:getid()});
                tape.push(i64.const,init,local.set,getid());
            }
            if(group=="N"){
                local.i64++;
                localv.push({name:name,group:group,id:getid()});
                tape.push(i64.const,init,local.set,getid());
            }
            if(group=="C"){
                local.v128++;
                localv.push({name:name,group:group,id:getid()});
                tape.push(...v128.const,...ieee754(init[0]),...ieee754(init[1]),local.set,getid());
            }
        }
            function createLocal(value,group){
                const seed=Math.random();
                addLocal(seed,value,group);
                return localid(seed);
            }
            function loopstart(timerid,times,up){
                tape.push(op.block,op.void,op.loop,op.void);
                if(up){
                tape.push(local.get,timerid,...times,f64.eq);
                }else{
                    tape.push(local.get,timerid,f64.const,...ieee754(0),f64.eq);
                }
                tape.push(op.br_if,1);
            }
            function loopend(timerid,up){
                if(up){
                tape.push(local.get,timerid,f64.const,...ieee754(1),f64.add,local.set,timerid);
                }else{
                    tape.push(local.get,timerid,f64.const,...ieee754(-1),f64.add,local.set,timerid);
                }
                tape.push(op.br,0);
                tape.push(op.end,op.end);
            }
            function f64pown(){
                tape.push(local.set,forp.timera);
                tape.push(local.set,forp.v);
                tape.push(f64.const,...ieee754(1),local.set,forp.holdera);
                //consume2stacksoffloat32
                //holdera,timera,v
                loopstart(forp.timera);
                tape.push(local.get,forp.holdera,local.get,forp.v,f64.mul);
                tape.push(local.set,forp.holdera);
                loopend(forp.timera);
                tape.push(local.get,forp.holdera);
            }
            function f64factn(){
                //holdera,timera
                tape.push(local.set,forp.timera);
                tape.push(f64.const,...ieee754(1),local.set,forp.holdera);
                //consume2stacksoffloat32
                //holdera,timera,v
                loopstart(forp.timera);
                tape.push(local.get,forp.holdera,local.get,forp.timera,f64.mul);
                tape.push(local.set,forp.holdera);
                loopend(forp.timera);
                tape.push(local.get,forp.holdera);
            }
            function f64exp(){
                //float32->float32
                //ここでは、d,u,holders,timers,holdera,timeraを使う(他のループによく組み込まれるため)
                tape.push(local.set,forp.u);
                tape.push(local.get,forp.u,f64.const,...ieee754(0),f64.lt);
                tape.push(local.get,forp.u,f64.abs,f64.const,...ieee754(16),f64.div,local.set,forp.u);//uに代入
                tape.push(local.get,forp.u,f64.const,...ieee754(1.2),f64.mul,f64.floor,f64.const,...ieee754(12),f64.add,local.set,forp.d);
                tape.push(f64.const,...ieee754(1),local.set,forp.holders);
                tape.push(f64.const,...ieee754(1),local.set,forp.timers);
                tape.push(f64.const,...ieee754(1),local.set,forp.holdera);
                loopstart(forp.timers,[local.get,forp.d],true);
                //e^x a+=a*x/k; //k is counter like 1 2 3 4 ...
                tape.push(local.get,forp.holdera,
                          local.get,forp.u,local.get,forp.timers,f64.div,f64.mul,
                          local.set,forp.holdera);
                tape.push(local.get,forp.holders,local.get,forp.holdera,f64.add);
                tape.push(local.set,forp.holders);//なぜか本来のexpとは若干ずれた収束値になる。
                loopend(forp.timers,true);
                //stackにブール
                tape.push(op.if,op.void,
                          f64.const,...ieee754(1),local.get,forp.holders,f64.div,local.set,forp.holders,
                          op.else,op.end);
                tape.push(local.get,forp.holders,local.get,forp.holders,f64.mul,local.set,forp.holders);
                tape.push(local.get,forp.holders,local.get,forp.holders,f64.mul,local.set,forp.holders);
                tape.push(local.get,forp.holders,local.get,forp.holders,f64.mul,local.set,forp.holders);
                tape.push(local.get,forp.holders,local.get,forp.holders,f64.mul);
            }
            function f64multiply(){
                //直前のスタックをコピーする
                const id=localid("float64multiplier");
                tape.push(local.set,id);
                tape.push(local.get,id);
                tape.push(local.get,id);
            }
            function f64log(){
                //f32->f32
                tape.push(local.set,forp.w);
                tape.push(local.get,forp.w,f64.const,...ieee754(6),f64.add,f64.ceil,local.set,forp.timerp);
                tape.push(f64.const,...ieee754(0),local.set,forp.holderp);
                //holderp,timerp,wを使う
                loopstart(forp.timerp);
                tape.push(local.get,forp.holderp,f64.const,...ieee754(1),f64.sub);
                tape.push(local.get,forp.holderp,f64.neg);//-x
                f64exp();//e^-x
                tape.push(local.get,forp.w,f64.mul);
                tape.push(f64.add,local.set,forp.holderp);
                loopend(forp.timerp);
                tape.push(local.get,forp.holderp);
            }
            function f64pow(){
                tape.push(local.set,forp.y,local.set,forp.x);
                tape.push(local.get,forp.y,local.get,forp.y,f64.floor,f64.eq);
                tape.push(op.if,op.f64);
                tape.push(local.get,forp.x);
                tape.push(local.get,forp.y);
                f64pown();
                tape.push(op.else);
                //素晴らしい冪乗近似を思いついた。
                tape.push(local.get,forp.x);
                f64log();
                tape.push(local.get,forp.y,f64.mul);
                f64exp();
                tape.push(op.end);
            }
            function f64mod(){
                //f64,f64->f64
                //use,z,w
                tape.push(local.set,forp.w,local.set,forp.z);
                tape.push(local.get,forp.z,local.get,forp.w,local.get,forp.z,local.get,forp.w);
                tape.push(f64.div,f64.floor,f64.mul,f64.sub);
            }
            function f64negk(){
                //intger f64->1 or -1
                //return value is should be f64.neg or nothing? Nuh I can use value one or minus one
                tape.push(f64.const,...ieee754(2));
                f64mod();
                tape.push(f64.neg,f64.const,...ieee754(2),f64.mul,f64.const,...ieee754(1),f64.add);
            }
            function f64cos(){
                //入力x,use timer holder holderp f64->f64
                tape.push(local.set,forp.x,f64.const,...ieee754(1),local.set,forp.timer,f64.const,...ieee754(1),local.set,forp.holder,f64.const,...ieee754(1),local.set,forp.holderp);
                //stack floor(x/pi+0.5)
                tape.push(local.get,forp.x,f64.const,...ieee754(0.3183098861837907),f64.mul,f64.const,...ieee754(0.5),f64.add,
                          f64.floor);
                f64negk();
                //xの加工
                tape.push(f64.const,...ieee754(0.6366197723675814),local.get,forp.x,f64.mul,f64.floor);
                f64negk();
                tape.push(local.get,forp.x,f64.mul);
                tau();
                f64mod();
                tape.push(local.set,forp.x);
                loopstart(forp.timer,[f64.const,...ieee754(12)],true);
                tape.push(local.get,forp.holderp,
                          local.get,forp.x,f64.neg,local.get,forp.x,f64.mul,
                          f64.const,...ieee754(2),local.get,forp.timer,f64.mul,f64.const,...ieee754(1),f64.sub,
                          f64.const,...ieee754(2),local.get,forp.timer,f64.mul,f64.mul,
                          f64.div,f64.mul,local.set,forp.holderp);
                tape.push(local.get,forp.holder,local.get,forp.holderp,f64.add,local.set,forp.holder);
                loopend(forp.timer,true);
                tape.push(local.get,forp.holder,f64.mul);
            }
            const c128={
                const(a,b){
                    tape.push();
                },
            }
            let tape=[];
            if(kst.type=="Literal"){
                if(mother=="R"){
                    tape.push(f64.const,...ieee754(kst.value));
                }
                if(mother=="Z"){
                    tape.push(f64.const,...leb128(kst.value));
                }
                if(mother=="C"){
                    tape.push(...v128.const,...ieee754(kst.value),0,0,0,0,0,0,0,0);
                }
            }
            if(kst.type=="Identifier"){
                //local.get
                if(kst.name=="otherwise" || kst.name=="true"){
                    tape.push(i64.const,1);
                }else if(kst.name=="i"){
                    tape.push(...v128.const,0,0,0,0,0,0,0,0,...ieee754(1));
                }else{
                    tape.push(local.get,localid(kst.name));
                }
            }
            if(kst.type=="decl"){
                addLocal(kst.name,kst.value.value,kst.group);
            }
            if(kst.type=="BinaryExpression"){
                if(kst.group=="guess"){
                    kst.group=mother;
                }
                if(kst.operator=="+"){
                    if(kst.group=="R"){
                        tape.push(...parseAST(kst.left,"R"),...parseAST(kst.right,"R"),f64.add);
                    }
                    if(kst.group=="Z"){
                        tape.push(...parseAST(kst.left,"Z"),...parseAST(kst.right,"Z"),i64.add);
                    }
                }
                if(kst.operator=="-"){
                    if(kst.group=="R"){
                        tape.push(...parseAST(kst.left,"R"),...parseAST(kst.right,"R"),f64.sub);
                    }
                    if(kst.group=="Z"){
                        tape.push(...parseAST(kst.left,"Z"),...parseAST(kst.right,"Z"),i64.sub);
                    }
                }
                if(kst.operator=="*"){
                    if(kst.group=="R"){
                        tape.push(...parseAST(kst.left,"R"),...parseAST(kst.right,"R"),f64.mul);
                    }
                    if(kst.group=="Z"){
                        tape.push(...parseAST(kst.left,"Z"),...parseAST(kst.right,"Z"),i64.mul);
                    }
                }
                if(kst.operator=="/"){
                    if(kst.group=="R"){
                        tape.push(...parseAST(kst.left,"R"),...parseAST(kst.right,"R"),f64.div);
                    }
                    if(kst.group=="Z"){
                        tape.push(...parseAST(kst.left,"Z"),...parseAST(kst.right,"Z"),i64.div_s);
                    }
                    if(kst.group=="N"){
                        tape.push(...parseAST(kst.left,"Z"),...parseAST(kst.right,"Z"),i64.div_u);
                    }
                }
                if(kst.operator=="^"){
                    if(kst.group=="R"){
                        tape.push(...parseAST(kst.left,"R"));
                        tape.push(...parseAST(kst.right,"R"));
                        f64pow();
                    }
                    if(kst.group=="Z"){
                    }
                }
                if(kst.operator=="%"){
                    tape.push(...parseAST(kst.left));
                    tape.push(...parseAST(kst.right));
                    tape.push(...parseAST(kst.left));
                    tape.push(...parseAST(kst.right));
                    tape.push(f64.div,f64.floor,f64.mul,f64.sub);
                }
                //条件
                if(kst.operator=="=" || kst.operator=="=="){
                    tape.push(...parseAST(kst.left),...parseAST(kst.right),f64.eq);
                }
                if(kst.operator=="<"){
                    tape.push(...parseAST(kst.left),...parseAST(kst.right),f64.lt);
                }
                if(kst.operator=="<="){
                    tape.push(...parseAST(kst.left),...parseAST(kst.right),f64.le);
                }
                if(kst.operator==">"){
                    tape.push(...parseAST(kst.left),...parseAST(kst.right),f64.gt);
                }
                if(kst.operator==">="){
                    tape.push(...parseAST(kst.left),...parseAST(kst.right),f64.ge);
                }
                if(kst.in=="|"){
                    tape.push(f64.abs);
                }
            }
            if(kst.type=="CallExpression"){
                if(kst.group=="guess"){
                    kst.group=mother;
                }
                if(kst.callee.name=="cos"){
                    if(kst.group=="R"){
                        tape.push(...parseAST(kst.arguments[0],"R"));
                        f64cos();
                    }
                }
                if(kst.callee.name=="sin"){
                    if(kst.group=="R"){
                        tape.push(...parseAST(kst.arguments[0],"R"));
                        tape.push(local.set,forp.d);
                        tape.push(local.get,forp.d,f64.const,...ieee754(0),f64.eq,op.if,op.f64);
                        tape.push(f64.const,...ieee754(0),op.else);
                        tape.push(local.get,forp.d,f64.const,...ieee754(Math.PI/2));
                        tape.push(f64.sub);
                        f64cos();
                        tape.push(op.end);
                    }
                }
                if(kst.callee.name=="tan"){
                    if(kst.group=="R"){
                        tape.push(...parseAST(kst.arguments[0],"R"));
                        tape.push(local.set,forp.d);
                        tape.push(local.get,forp.d,f64.const,...ieee754(0),f64.eq,op.if,op.f64);
                        tape.push(f64.const,...ieee754(0),op.else);
                        tape.push(local.get,forp.d,f64.const,...ieee754(Math.PI/2));
                        tape.push(f64.sub);
                        f64cos();
                        tape.push(op.end);
                        tape.push(local.get,forp.d);
                        f64cos();
                        tape.push(f64.div);
                    }
                }
            }
            if(kst.type=="print"){
                if(kst.group=="guess"){
                    kst.group=mother;
                }
                if(kst.group=="R"){
                    tape.push(...parseAST(kst.argument,"R"),op.call,0);
                }
                if(kst.group=="C"){
                    tape.push(...parseAST(kst.argument,"C"));
                    tape.push(local.set,forp.c);
                    tape.push(local.get,forp.c,...f64x2.extract,0);
                    tape.push(local.get,forp.c,...f64x2.extract,1);
                    tape.push(op.call,1);
                }
            }
            if(kst.type=="UnaryExpression"){
                if(kst.operator=="$"){
                tape.push(...parseAST(kst.value,"R"),f64.sqrt);
                }
                if(kst.operator=="!"){
                    //整数階乗
                    tape.push(...parseAST(kst.value,"R"));
                    f64factn();
                }
                if(kst.operator=="~"){
                }
                if(kst.operator=="°"){
                }
                if(kst.in=="|"){
                    tape.push(f64.abs);
                }
            }
            if(kst.type=="PiecewiseExpression"){
                function parseConditions(k){
                    tape.push(...parseAST(kst.tree[k].conditions),op.if,op.f64);
                    tape.push(...parseAST(kst.tree[k].res),op.else);
                    if(k+1==kst.tree.length){
                    tape.push(f64.const,...ieee754(0));//でなければ
                    }else{
                        parseConditions(k+1);
                    }
                    tape.push(op.end);
                }
                parseConditions(0);
            }
            return tape;
        }
        if(asts.indexOf("errorDetected")==-1){
        let code=[];
            for(const ast of asts){
        code.push(...parseAST(ast,"R"));
            }
            console.log(localv);
            console.log(code);
            const codelength=leb128_u(code.length+8);
            const binaryArray=Uint8Array.from([
        //magic
        ...[0x00, 0x61, 0x73, 0x6d],
        ...[0x01, 0x00, 0x00, 0x00],
        //type,size,functypecount
        ...[0x01,1+3+4+5,0x03],
        //functype,param type(count,type),result type
        ...[0x60,0x01,op.f64,0x00],
        ...[0x60,0x02,op.f64,op.f64,0x00],
        ...[0x60,0x00,0x00],
        //import,size,imp count
        ...[0x02,1+13+13,0x02],
        //modulename,fieldname,kind(=0でfunction),signatureindex
        ...[0x03,...UTFer("env"),0x06,...UTFer("printf"),0x00,0x00],
        ...[0x03,...UTFer("env"),0x06,...UTFer("printc"),0x00,0x01],
        //Function,size,funccount,index
        ...[0x03,0x02,0x01,0x00],
        //exports,size,export数,名前,kind,typeindex
        ...[0x07,0x07,0x01,0x03,114,101,115,0x00,0x02],
        //code,size,function数
        ...[0x0a,...leb128_u(code.length+9+codelength.length),0x01],
        //size,local declear count,...types
        ...[...codelength,0x03,local.f64,op.f64,local.i64,op.i64,local.v128,op.v128],
        ...code,op.end
    ]);
    const imports={
        env:{
            printf:x=>console.log(x),
            printc(x,y){
                //expect c128
                if(x==0 && y!=0){
                    console.log(`${y}i`);
                }
                if(y==0){
                    console.log(x);
                }
                //x and y is not equal to zero
                let operator="+";
                if(y<0){
                    operator="-";
                }
                console.log(`${x}${operator}${y}`);
            }
        }
    }
    const compiled=new WebAssembly.Instance(new WebAssembly.Module(binaryArray),imports).exports.res;
            blueocean.wasmStack.push({code:midoricode,output:compiled,input:[]});
            return compiled;
        }
        return "console.error('コンパイルに失敗:'+code)";
    },
    call(code){
        const id=blueocean.wasmStack.findIndex(e=>e.code==code);
        if(id==-1){
        return blueocean.wasmer(code)();
        }
        return blueocean.wasmStack[id].output();
    },
    parse(filename){
        fetch(filename).then(a=>{
            a.text().then(v=>{blueocean.call(v)});
        });
    }
}
function speedTest(c1,c2,times){
    let t=performance.now();
    for(let k=0; k<times; ++k){
        eval(c1);
    }
    console.log(`${c1}: ${performance.now()-t}ms`);
    console.log(`${eval(c1)}`);
    t=performance.now();
    for(let k=0; k<times; ++k){
        blueocean.callf(c2);
    }
    console.log(`${c2}: ${performance.now()-t}ms`);
    console.log(`${blueocean.callf(c2)}`);
}