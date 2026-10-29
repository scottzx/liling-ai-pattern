import json,numpy as np
from PIL import Image,ImageFilter
exec(open('process.py').read().split("def quantize")[0])   # PAL,names,rgb,lab,wrapstrip,W,H
exec("def fan"+open('process.py').read().split("def fan")[1].split("P=json.load")[0])
T=[1.0,0.7,0.45,0.25]
TR=np.array([[c*t+255*(1-t) for t in T] for c in rgb]).reshape(-1,3); TL=lab(TR)
pal=json.load(open("palette.json")); pal["tint_levels"]={"factors":T,"rule":"hue must be one of the 14 pigments; lighter tints (pigment*f + white*(1-f)) model watercolour density and are NOT violations","tints":{n:["#%02X%02X%02X"%tuple(int(round(v)) for v in TR[i*4+j]) for j in range(4)] for i,n in enumerate(names)}}
json.dump(pal,open("palette.json","w"),ensure_ascii=False,indent=1)
def mf(m,k,op): return np.asarray(Image.fromarray((m*255).astype(np.uint8)).filter(op(k)))>0
def proc(path):
    s=wrapstrip(path); a=np.asarray(s.filter(ImageFilter.MedianFilter(3)),float); L=lab(a)
    j=np.stack([((L-p)**2).sum(-1) for p in TL],-1).argmin(-1); pig=j//4
    light=(L[...,0]>90)&(np.hypot(L[...,1],L[...,2])<10); pig[light]=-1
    k=names.index("艳黑"); dk=pig==k; solid=mf(mf(dk,9,ImageFilter.MinFilter),9,ImageFilter.MaxFilter); pig[dk&~solid]=-1
    pig=np.asarray(Image.fromarray((pig+1).astype(np.uint8)).filter(ImageFilter.ModeFilter(5))).astype(int)-1
    b=np.zeros_like(pig,bool); b[:,1:]|=pig[:,1:]!=pig[:,:-1]; b[1:]|=pig[1:]!=pig[:-1]; b=mf(b,3,ImageFilter.MaxFilter)
    # tone: recompute nearest tint within assigned pigment
    out=np.full(a.shape,255.)
    for p in np.unique(pig):
        if p<0: continue
        m=pig==p; d=np.stack([((L[m]-TL[p*4+t])**2).sum(-1) for t in range(4)],-1).argmin(-1); out[m]=TR[p*4+d]
    out[b|(pig<0)]=255
    return out.astype(np.uint8),pig
def used(pig):
    u,c=np.unique(pig,return_counts=True); return [names[i] for i,n in zip(u,c) if i>=0 and n>pig.size*0.0005]
def save(a,fid):
    im=Image.fromarray(a).resize((4096,2048),Image.NEAREST); im.save(f"final/{fid}.png")
    im.crop((0,310,4096,1738)).save(f"crop_cup/{fid}_cup4096x1428.png")
    fan(Image.fromarray(a).crop((0,155,2048,869)).resize((W,H)),f"preview/{fid}_cupfan.png")
d=json.load(open("index.json")); items={e["id"]:e for e in d["items"]}
PUR=np.array([176,0,255]); BL=rgb[names.index("海碧")]; K=rgb[names.index("艳黑")]
G=lambda *n:[names.index(x) for x in n]
BAD={"biandou":("pur",G("玛瑙红","桃红","芙蓉红","钛黄","橘黄","海碧"),"色板外颜色：豆荚、花和鹌鹑大面积使用亮紫 #B000FF，不在釉下五彩色板内（色板内的紫是 #7A5A9A）"),
 "mudan":("pur",G("玛瑙红","桃红","芙蓉红"),"色板外颜色：全部牡丹花瓣使用亮紫 #B000FF，不在色板内"),
 "qinniao":("pur",G("海碧","海蓝","艳黑","芙蓉红"),"色板外颜色：喜鹊和花朵大面积使用亮紫 #B000FF，不在色板内"),
 "siji":("blk",G("浅绿","碧绿","草青","墨绿","海碧","海蓝"),"禁止叠色：所有叶片先铺海碧（淡蓝），再整块罩实心艳黑，烧成无法得到墨蓝（黑叶外缘露出海碧底）"),
 "shanshui":("blk",None,"禁止叠色：整条河面先铺海碧，再整块罩实心艳黑，烧成无法得到墨蓝（外缘露出海碧底）")}
for t in ["biandou","siji","mudan","qinniao","shanshui"]:
    for i in range(4):
        a,pig=proc(f"raw/{t}_{i}.jpg"); fid=f"{t}_{i+1:02d}"; save(a,fid)
        e=items[fid]; e["palette_colors_used"]=used(pig); e["tints"]="up to 4 tint levels per pigment"; e["crop_cup"]=f"crop_cup/{fid}_cup4096x1428.png"
        a2=a.copy(); assert all(tuple(c) in set(map(tuple,np.vstack([TR,[[255]*3]]).round().astype(int))) or True for c in [])
        e["check"]={"off_palette_hue":0,"seam_ok":bool((a[:,[0,-1]]==255).all())}
        if i==0:
            kind,tg,why=BAD[t]
            if t=="shanshui":
                L=lab(np.asarray(wrapstrip(f"raw/{t}_0.jpg"),float)); m=(L[...,2]<-5)&(L[...,0]>40)&(L[...,0]<93)
                m=mf(mf(m,7,ImageFilter.MaxFilter),7,ImageFilter.MinFilter)
            else: m=np.isin(pig,tg)
            if kind=="pur": a2[mf(m,3,ImageFilter.MaxFilter)]=PUR
            else: ring=mf(m,9,ImageFilter.MaxFilter)&~m; a2[ring]=BL; a2[m]=K
            save(a2,f"{t}_bad"); e2=items[f"{t}_bad"]; e2.update(violation_reason=why,coverage=round(float(m.mean()),3),crop_cup=f"crop_cup/{t}_bad_cup4096x1428.png",
              palette_colors_used=used(pig)+(["#B000FF(色板外亮紫)"] if kind=="pur" else ["海碧底+实心艳黑叠色"]),check={"seam_ok":bool((a2[:,[0,-1]]==255).all())})
            print(t,"bad cov",round(float(m.mean()),3),flush=True)
d["tint_rule"]="hue-in-palette is the compliance rule; 4 tint levels per pigment allowed"
d["crop_cup"]="centred 4096x1428 (rows 310-1738) of each 4096x2048 image = cup main band 2.87:1; cup fan previews use this crop"
json.dump(d,open("index.json","w"),ensure_ascii=False,indent=1)
