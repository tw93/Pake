var m=Object.defineProperty,p=Object.defineProperties;var d=Object.getOwnPropertyDescriptors;var e=Object.getOwnPropertySymbols;var g=Object.prototype.hasOwnProperty,f=Object.prototype.propertyIsEnumerable;var n=(t,o,i)=>o in t?m(t,o,{enumerable:!0,configurable:!0,writable:!0,value:i}):t[o]=i,r=(t,o)=>{for(var i in o||(o={}))g.call(o,i)&&n(t,i,o[i]);if(e)for(var i of e(o))f.call(o,i)&&n(t,i,o[i]);return t},s=(t,o)=>p(t,d(o));var a=(t,o,i)=>n(t,typeof o!="symbol"?o+"":o,i);import{d6 as C,ce as y,b2 as c}from"./index-DzJUk-4s.js";import{aa as l}from"./index-B2h3DCGB.js";import"./plugin-BZaVEG5Y.js";import"./icon-Bt2TghsQ.js";import"./file-BoGdIhh5.js";import"./systemStore-CDAOEx2u.js";import"./index-DumZb7Zp.js";import"./index-YIaHLc6Z.js";import"./fileTypeEnum-22QBGXO_.js";const b=`<style>
  .my-class {
    color: #fff;
    width: 100%;
    height: 100%;
    font-size: 26px;
    background: linear-gradient(90deg, rgba(187, 116, 220, 0.57) 0%, rgba(36, 134, 185, 0.57) 100%);
  }
</style>
<div class='my-class'
  onclick="(()=>{window.$globalExposeFunction.triggerComponentEventById('组件ID', 'click' , '1')})()">
  HTML 内容，onclick等事件中触发全局方法可以实现交互动作。
</div>`,k={dataset:b};class B extends C{constructor(){super(...arguments);a(this,"key",l.key);a(this,"attr",s(r({},y),{zIndex:-1}));a(this,"chartConfig",c(l));a(this,"option",c(k))}}export{B as default,k as option};
