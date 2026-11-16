import forge from 'node-forge';
import {zipSync} from 'fflate';
forge.options.usePureJavaScript=true;
// Browser-target bundles omit Node crypto. Use the Worker CSPRNG directly
// even when the runtime exposes a Node-compatible process object.
function secureRandom(count){let out='';while(count>0){const bytes=crypto.getRandomValues(new Uint8Array(Math.min(count,65536)));for(const byte of bytes)out+=String.fromCharCode(byte);count-=bytes.length;}return out;}
forge.random.getBytesSync=secureRandom;
forge.random.seedFileSync=secureRandom;
forge.random.seedFile=(count,callback)=>{try{callback(null,secureRandom(count));}catch(error){callback(error);}};

const te=new TextEncoder();
export const PASS_TYPE='pass.com.amplyfyconsulting.rewards';
export const TEAM_ID='4Z7XC628PV';
const binary=bytes=>{let s='';for(const b of bytes)s+=String.fromCharCode(b);return s};
export function importIdentity(bytes,password,intermediatePem,{now=new Date(),passType=PASS_TYPE,teamId=TEAM_ID}={}){
  let p12;
  try{p12=forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(binary(bytes)),false,password)}catch{throw new Error('The .p12 could not be opened. Check the export password and try again.')}
  const keys=[...(p12.getBags({bagType:forge.pki.oids.pkcs8ShroudedKeyBag})[forge.pki.oids.pkcs8ShroudedKeyBag]||[]),...(p12.getBags({bagType:forge.pki.oids.keyBag})[forge.pki.oids.keyBag]||[])].map(b=>b.key).filter(Boolean);
  const certs=(p12.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]||[]).map(b=>b.cert).filter(Boolean);
  const intermediate=forge.pki.certificateFromPem(intermediatePem);
  for(const cert of certs){
    const uid=cert.subject.getField({type:'0.9.2342.19200300.100.1.1'})?.value;
    const team=cert.subject.getField('OU')?.value;
    if(uid!==passType||team!==teamId)continue;
    if(cert.validity.notBefore>now||cert.validity.notAfter<=now)throw new Error('This signing certificate is expired or not yet valid. Download a current Pass Type ID certificate.');
    if(!intermediate.verify(cert))throw new Error('This certificate could not be verified against Apple’s Wallet certificate authority.');
    const privateKey=keys.find(k=>k.n?.compareTo(cert.publicKey.n)===0&&k.e?.compareTo(cert.publicKey.e)===0);
    if(!privateKey)throw new Error('The .p12 does not include the matching private key. Export the certificate from My Certificates on the Mac that created the request.');
    if(privateKey.n.bitLength()<2048)throw new Error('The certificate key must be at least 2048 bits.');
    return {privateKey:forge.pki.privateKeyToPem(privateKey),certificate:forge.pki.certificateToPem(cert),teamId,passType,expires:cert.validity.notAfter.toISOString()};
  }
  throw new Error('Choose the .p12 for AMPLYFY Rewards (pass.com.amplyfyconsulting.rewards) from the AMPLYFY Apple Developer team.');
}
export function createPass({identity,intermediatePem,round,origin,images}){
  if(new Date(identity.expires)<=new Date())throw new Error('The Wallet signing certificate has expired.');
  const serial='AMPLYFY-'+round.id;
  const pass={formatVersion:1,passTypeIdentifier:identity.passType,serialNumber:serial,teamIdentifier:identity.teamId,organizationName:'AMPLYFY LLC',description:'$'+round.amount+' off your AMPLYFY setup fee',logoText:'AMPLYFY',foregroundColor:'rgb(20, 16, 12)',backgroundColor:'rgb(255, 145, 20)',labelColor:'rgb(90, 43, 0)',sharingProhibited:true,coupon:{primaryFields:[{key:'reward',label:'OFF YOUR SETUP FEE',value:'$'+round.amount}],secondaryFields:[{key:'service',label:'YOUR REWARD',value:'AMPLYFY Card Experience'}],auxiliaryFields:[{key:'reference',label:'REWARD ID',value:round.id.slice(0,8).toUpperCase()}],backFields:[{key:'details',label:'Your reward',value:'$'+round.amount+' off your AMPLYFY card-experience setup fee. Show this pass during your consultation.'},{key:'booking',label:'Book your 30-minute introduction',value:'https://calendar.app.google/T1cWtkHnVcJiuWpz8'},{key:'reference-full',label:'Reward reference',value:serial},{key:'terms',label:'Redemption',value:'Valid toward AMPLYFY setup services. Subject to verification of this reward ID. No cash value.'}]}};
  const files={'pass.json':te.encode(JSON.stringify(pass)),...images};
  const manifest={};for(const [name,value]of Object.entries(files))manifest[name]=forge.md.sha1.create().update(binary(value)).digest().toHex();
  const manifestText=JSON.stringify(manifest);files['manifest.json']=te.encode(manifestText);
  const cms=forge.pkcs7.createSignedData();cms.content=forge.util.createBuffer(manifestText,'utf8');cms.addCertificate(identity.certificate);cms.addCertificate(intermediatePem);cms.addSigner({key:identity.privateKey,certificate:identity.certificate,digestAlgorithm:forge.pki.oids.sha256,authenticatedAttributes:[{type:forge.pki.oids.contentType,value:forge.pki.oids.data},{type:forge.pki.oids.messageDigest},{type:forge.pki.oids.signingTime,value:new Date()}]});cms.sign({detached:true});files.signature=Uint8Array.from(forge.asn1.toDer(cms.toAsn1()).getBytes(),c=>c.charCodeAt(0));
  return zipSync(files,{level:6});
}
