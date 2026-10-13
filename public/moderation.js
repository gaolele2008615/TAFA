(function(root){
  const words = ["操你妈","草你妈","艹你妈","曹你妈","你妈死了","你妈","他妈","妈的","妈逼","妈了个逼","傻逼","傻B","SB","煞笔","沙比","傻批","二逼","二货","滚","去死","死全家","杂种","狗娘养","王八蛋","混蛋","畜生","贱人","婊子","妓女","嫖娼","卖淫","骚货","贱货","母狗","脑残","智障","弱智","白痴","神经病","变态","人妖","娘炮","死胖子","肥猪","丑八怪","废物","狗东西","龟儿子","下贱","恶心","垃圾东西","杀你","砍你","弄死你","打死你","揍你","灭你","血洗","炸学校","人肉","开盒","曝光隐私","自杀","自残","约炮","一夜情","裸聊","黄片","AV","成人网站","福利姬","性服务","开房","上床","嫖娼","卖淫","骚货","贱货","母狗","加微信","加QQ","扫码","兼职","日结","刷单","返利","博彩","赌球","代购","微商","代写","代考","论文","答案","贷款","套现","办证","发票","出售","低价","毒品","冰毒","大麻","枪支","弹药","炸药","赌博","洗钱","诈骗","传销","黑客","盗号","外挂","nmsl","cnm","rnm","tmd","mmp","mdzz","sb","shabi","caonima","cao","ri","zz","nc","好望角","荷马","尚岸"];
  const normalize = value => String(value).normalize('NFKC').toLowerCase().replace(/[\p{Z}\p{P}\p{S}\p{C}]/gu,'');
  const terms=[...new Set(words.map(normalize))];
  const api={words,normalize,blocked(value){const text=normalize(value);return terms.some(term=>text.includes(term));},warning:'警告：内容包含禁用词语，请修改后再发布。'};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TafaModeration=api;
})(typeof window!=='undefined'?window:globalThis);
