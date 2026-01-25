import{u as j,j as e,S as c,L as r,I as o}from"./index-C50GjM4J.js";import{T as y}from"./textarea-DH0yP9d7.js";function C({componentId:i}){const{nodes:d,updateNode:m}=j(),s=d.find(a=>a.id===i);if(!s)return e.jsx("div",{className:"p-4 text-muted-foreground",children:"Component not found"});const t=s.data.config||{},p=t.image||"nginx:latest",x=t.replicas||1,g=t.memory||"512Mi",u=t.cpu||"500m",h=t.yaml||(s.type==="docker"?`FROM nginx:latest
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`:`apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: nginx:latest
        ports:
        - containerPort: 80`),n=a=>{m(i,{data:{...s.data,config:{...t,...a}}})},f=()=>s.type==="docker"?"Docker":"Kubernetes",l=()=>s.type==="docker"?"Dockerfile":"Deployment YAML";return e.jsx("div",{className:"h-full overflow-y-auto bg-background",children:e.jsxs("div",{className:"p-6 space-y-6",children:[e.jsxs("div",{children:[e.jsxs("h2",{className:"text-2xl font-bold text-foreground",children:[f()," Configuration"]}),e.jsx("p",{className:"text-sm text-muted-foreground mt-1",children:"Configure container and orchestration settings"})]}),e.jsx(c,{}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"text-lg font-semibold text-foreground",children:"Container Settings"}),e.jsx("p",{className:"text-sm text-muted-foreground",children:"Basic container configuration"})]}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"space-y-2",children:[e.jsx(r,{htmlFor:"image",children:"Image"}),e.jsx(o,{id:"image",value:p,onChange:a=>n({image:a.target.value}),placeholder:"nginx:latest"})]}),s.type==="kubernetes"&&e.jsxs("div",{className:"grid grid-cols-3 gap-4",children:[e.jsxs("div",{className:"space-y-2",children:[e.jsx(r,{htmlFor:"replicas",children:"Replicas"}),e.jsx(o,{id:"replicas",type:"number",min:"1",value:x,onChange:a=>n({replicas:parseInt(a.target.value)||1}),placeholder:"1"})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(r,{htmlFor:"memory",children:"Memory"}),e.jsx(o,{id:"memory",value:g,onChange:a=>n({memory:a.target.value}),placeholder:"512Mi"})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(r,{htmlFor:"cpu",children:"CPU"}),e.jsx(o,{id:"cpu",value:u,onChange:a=>n({cpu:a.target.value}),placeholder:"500m"})]})]})]})]}),e.jsx(c,{}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"text-lg font-semibold text-foreground",children:l()}),e.jsx("p",{className:"text-sm text-muted-foreground",children:s.type==="docker"?"Docker configuration file":"Kubernetes manifest"})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(r,{htmlFor:"yaml",children:"Configuration"}),e.jsx(y,{id:"yaml",value:h,onChange:a=>n({yaml:a.target.value}),className:"font-mono text-sm h-96",placeholder:`Enter ${l()} configuration...`})]})]})]})})}export{C as InfrastructureConfig};
