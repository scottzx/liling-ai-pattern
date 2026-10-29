import json,math,numpy as np
from PIL import Image,ImageFilter,ImageDraw
PAL={"玛瑙红":"#B8323A","桃红":"#E07A8F","芙蓉红":"#E8A0A0","海碧":"#2F6FA8","海蓝":"#3D5A98","草青":"#4E8C4A","浅绿":"#9CC79A","墨绿":"#2E5A3A","碧绿":"#3E9A8A","钛黄":"#E8C84A","橘黄":"#E89A3A","赭色":"#8A5A3A","紫":"#7A5A9A","艳黑":"#2A2A2A"}
json.dump({"label":"demo palette, to be calibrated by factory — approximate sRGB hex, not measured fired colours","outline":"#FFFFFF","ground":"#FFFFFF","pigments":PAL},open("palette.json","w"),ensure_ascii=False,indent=1)
names=list(PAL); rgb=np.array([[int(h[i:i+2],16) for i in (1,3,5)] for h in PAL.values()],float)
W,H=2048,1024  # working size; saved upscaled to 4096x2048 (2:1, frontend spec)
def lab(a):
    a=a/255.; a=np.where(a>0.04045,((a+0.055)/1.055)**2.4,a/12.92)
    M=np.array([[0.4124,0.3576,0.1805],[0.2126,0.7152,0.0722],[0.0193,0.1192,0.9505]])
    x=a@M.T/np.array([0.9505,1,1.089]); f=np.where(x>0.008856,np.cbrt(x),7.787*x+16/116)
    return np.stack([116*f[...,1]-16,500*(f[...,0]-f[...,1]),200*(f[...,1]-f[...,2])],-1)
PL=lab(rgb)
def wrapstrip(path):
    im=Image.open(path).convert("RGB"); w,h=im.size; nw=int(round(h*W/H))
    c=Image.new("RGB",(nw,h),(255,255,255)); c.paste(im,((nw-w)//2,0))
    a=np.asarray(c,float); x=np.arange(nw); 
    # fade 3% at each edge to white so L/R edges both = white -> seamless tile
    f=np.clip(np.minimum(x,nw-1-x)/(0.03*nw),0,1)[None,:,None]; a=a*f+255*(1-f)
    return Image.fromarray(a.astype(np.uint8)).resize((W,H),Image.LANCZOS)
def quantize(img):
    a=np.asarray(img.filter(ImageFilter.MedianFilter(5)),float)
    L=lab(a); out=np.full(a.shape[:2],-1)
    light=(L[...,0]>86)&(np.hypot(L[...,1],L[...,2])<14)   # paper -> white
    idx=np.stack([((L-p)**2).sum(-1) for p in PL],-1).argmin(-1); idx[light]=-1
    # thin dark line art -> white outline (双勾分水 white line); keep solid dark masses as 艳黑
    k=names.index("艳黑"); dark=Image.fromarray(((idx==k)*255).astype(np.uint8))
    solid=np.asarray(dark.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.MaxFilter(9)))>0
    idx[(idx==k)&~solid]=-1
    # clean speckle with mode filter
    im=Image.fromarray((idx+1).astype(np.uint8)).filter(ImageFilter.ModeFilter(7)); idx=np.asarray(im).astype(int)-1
    # white boundary between different colour areas
    b=np.zeros_like(idx,bool); b[:,1:]|=(idx[:,1:]!=idx[:,:-1]); b[1:]|=(idx[1:]!=idx[:-1])
    b=np.asarray(Image.fromarray((b*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)))>0
    idx[b]=-1
    lut=np.vstack([rgb,[[255,255,255]]]).astype(np.uint8)
    return Image.fromarray(lut[idx]),idx
def used(idx):
    u,c=np.unique(idx,return_counts=True); return [names[i] for i,n in zip(u,c) if i>=0 and n>idx.size*0.0005]
def fan(img,path):
    s,ra,rb=96.2,37.4,43.9; Ri=ra*s/(rb-ra); Ro=Ri+s; th=2*math.pi*rb/Ro
    a=np.asarray(img); S=1400; sc=(S-40)/(2*Ro*math.sin(th/2)); hh=int((Ro-Ri*math.cos(th/2))*sc)+40
    yy,xx=np.mgrid[0:hh,0:S]; cx=S/2; cy=20+Ro*sc
    dx=(xx-cx)/sc; dy=(cy-yy)/sc; r=np.hypot(dx,dy); t=np.arctan2(dx,dy)
    m=(r>=Ri)&(r<=Ro)&(abs(t)<=th/2)
    u=((t/th+0.5)*(W-1)).clip(0,W-1).astype(int); v=((Ro-r)/s*(H-1)).clip(0,H-1).astype(int)
    o=np.full((hh,S,3),235,np.uint8); o[m]=a[v[m],u[m]]
    Image.fromarray(o).save(path)
P=json.load(open("prompts.json")); STYLE=open("gen.txt").readline().split(" ",2)[2].split(": ")[0]+": "
TH={"biandou":"扁豆双禽","siji":"四季花卉","mudan":"牡丹","qinniao":"禽鸟花卉","shanshui":"醴陵山水"}
VIO={"biandou":("offpal","#FF1FA8","色板外颜色：荧光品红 #FF1FA8（替换玛瑙红/桃红区域），不在釉下五彩色板内"),
 "siji":("overlap",None,"禁止叠色：艳黑罩在海碧（淡蓝）底上，烧成无法得到墨蓝"),
 "mudan":("offpal","#7FFF00","色板外颜色：荧光黄绿 #7FFF00（替换叶片绿色），不在色板内"),
 "qinniao":("offpal","#00E5FF","色板外颜色：亮青 #00E5FF（替换海碧/海蓝），不在色板内"),
 "shanshui":("overlap",None,"禁止叠色：艳黑罩在海碧（淡蓝）水面上，烧成无法得到墨蓝")}
index=[]
for t,pl in P.items():
    for i,p in enumerate(pl):
        q,idx=quantize(wrapstrip(f"raw/{t}_{i}.jpg")); fid=f"{t}_{i+1:02d}"
        q.resize((4096,2048),Image.NEAREST).save(f"final/{fid}.png"); fan(q,f"preview/{fid}_cupfan.png")
        index.append(dict(id=fid,theme=TH[t],prompt=STYLE+p,compliant=True,violation_reason=None,file=f"final/{fid}.png",preview=f"preview/{fid}_cupfan.png",palette_colors_used=used(idx)))
        if i==0:
            kind,hx,why=VIO[t]; a=np.asarray(q).copy(); vid=f"{t}_bad"
            if kind=="offpal":
                c=np.array([int(hx[j:j+2],16) for j in (1,3,5)])
                tgt={"biandou":["玛瑙红","桃红"],"mudan":["草青","浅绿","墨绿","碧绿"],"qinniao":["海碧","海蓝"]}[t]
                m=np.isin(idx,[names.index(n) for n in tgt]); a[m]=c
                if not m.any(): a[420:560,900:1150]=c
                cols=used(idx)+[hx+"(色板外)"]
            else:
                m=np.isin(idx,[names.index("海碧"),names.index("海蓝")])
                if m.sum()<5000: m=np.zeros_like(m); m[380:640,750:1300]=True; a[m]=rgb[names.index("海碧")]
                yy,xx=np.mgrid[0:H,0:W]; stripe=((xx+yy)//9)%3==0
                a[m&stripe]=rgb[names.index("艳黑")]; cols=used(idx)+["海碧+艳黑叠色"]
            Image.fromarray(a).resize((4096,2048),Image.NEAREST).save(f"final/{vid}.png"); fan(Image.fromarray(a),f"preview/{vid}_cupfan.png")
            index.append(dict(id=vid,theme=TH[t],prompt=STYLE+p+" (+ post-edit injection)",compliant=False,violation_reason=why,file=f"final/{vid}.png",preview=f"preview/{vid}_cupfan.png",palette_colors_used=cols))
        print(fid,flush=True)
# check
for e in index:
    a=np.asarray(Image.open(e["file"])).reshape(-1,3); ok=set(map(tuple,np.vstack([rgb,[[255]*3]]).astype(int)))
    off=sum(1 for c in np.unique(a,axis=0) if tuple(int(x) for x in c) not in ok)
    e["check"]={"off_palette_unique_colours":off,"seam_ok":bool((np.asarray(Image.open(e["file"]))[:,[0,-1]]==255).all())}
json.dump({"work_size":[W,H],"size_saved":[4096,2048],"aspect":"2:1, front centre at x=2048","items":index},open("index.json","w"),ensure_ascii=False,indent=1)
