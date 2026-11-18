import{f as e,h as t,n}from"./telemetry-Di1eFlCi.js";import{n as r}from"./dist-MwKS5WsN.js";import{a as i,o as a}from"./mission-DlYrKTuR.js";import{a as o,c as s,i as c,l,n as u,r as d,s as f}from"./mapLayers-BPeaejTc.js";import{$ as p,A as m,C as h,Ct as g,D as _,E as v,G as ee,H as te,I as y,J as b,K as x,L as ne,M as re,N as ie,O as ae,P as oe,Q as se,R as ce,S as le,T as ue,U as de,V as fe,X as S,Z as pe,_ as me,_t as he,a as ge,b as C,bt as w,c as _e,ct as T,d as ve,dt as E,f as D,ft as ye,g as be,h as xe,ht as O,i as Se,it as Ce,j as we,k as Te,l as Ee,lt as De,m as Oe,mt as ke,n as Ae,nt as je,o as Me,p as Ne,pt as Pe,q as k,r as Fe,rt as A,s as Ie,t as Le,tt as Re,u as j,v as ze,w as Be,wt as M,x as Ve,xt as N,y as He,yt as Ue}from"./DroneModel-CW3dOLS7.js";var We=h>=125?`uv1`:`uv2`,Ge=Object.defineProperty,Ke=(e,t,n)=>t in e?Ge(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n,qe=(e,t,n)=>(Ke(e,typeof t==`symbol`?t:t+``,n),n),Je=(()=>{let e={uniforms:{turbidity:{value:2},rayleigh:{value:1},mieCoefficient:{value:.005},mieDirectionalG:{value:.8},sunPosition:{value:new w},up:{value:new w(0,1,0)}},vertexShader:`
      uniform vec3 sunPosition;
      uniform float rayleigh;
      uniform float turbidity;
      uniform float mieCoefficient;
      uniform vec3 up;

      varying vec3 vWorldPosition;
      varying vec3 vSunDirection;
      varying float vSunfade;
      varying vec3 vBetaR;
      varying vec3 vBetaM;
      varying float vSunE;

      // constants for atmospheric scattering
      const float e = 2.71828182845904523536028747135266249775724709369995957;
      const float pi = 3.141592653589793238462643383279502884197169;

      // wavelength of used primaries, according to preetham
      const vec3 lambda = vec3( 680E-9, 550E-9, 450E-9 );
      // this pre-calcuation replaces older TotalRayleigh(vec3 lambda) function:
      // (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda, vec3(4.0)) * (6.0 - 7.0 * pn))
      const vec3 totalRayleigh = vec3( 5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5 );

      // mie stuff
      // K coefficient for the primaries
      const float v = 4.0;
      const vec3 K = vec3( 0.686, 0.678, 0.666 );
      // MieConst = pi * pow( ( 2.0 * pi ) / lambda, vec3( v - 2.0 ) ) * K
      const vec3 MieConst = vec3( 1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14 );

      // earth shadow hack
      // cutoffAngle = pi / 1.95;
      const float cutoffAngle = 1.6110731556870734;
      const float steepness = 1.5;
      const float EE = 1000.0;

      float sunIntensity( float zenithAngleCos ) {
        zenithAngleCos = clamp( zenithAngleCos, -1.0, 1.0 );
        return EE * max( 0.0, 1.0 - pow( e, -( ( cutoffAngle - acos( zenithAngleCos ) ) / steepness ) ) );
      }

      vec3 totalMie( float T ) {
        float c = ( 0.2 * T ) * 10E-18;
        return 0.434 * c * MieConst;
      }

      void main() {

        vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
        vWorldPosition = worldPosition.xyz;

        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        gl_Position.z = gl_Position.w; // set z to camera.far

        vSunDirection = normalize( sunPosition );

        vSunE = sunIntensity( dot( vSunDirection, up ) );

        vSunfade = 1.0 - clamp( 1.0 - exp( ( sunPosition.y / 450000.0 ) ), 0.0, 1.0 );

        float rayleighCoefficient = rayleigh - ( 1.0 * ( 1.0 - vSunfade ) );

      // extinction (absorbtion + out scattering)
      // rayleigh coefficients
        vBetaR = totalRayleigh * rayleighCoefficient;

      // mie coefficients
        vBetaM = totalMie( turbidity ) * mieCoefficient;

      }
    `,fragmentShader:`
      varying vec3 vWorldPosition;
      varying vec3 vSunDirection;
      varying float vSunfade;
      varying vec3 vBetaR;
      varying vec3 vBetaM;
      varying float vSunE;

      uniform float mieDirectionalG;
      uniform vec3 up;

      const vec3 cameraPos = vec3( 0.0, 0.0, 0.0 );

      // constants for atmospheric scattering
      const float pi = 3.141592653589793238462643383279502884197169;

      const float n = 1.0003; // refractive index of air
      const float N = 2.545E25; // number of molecules per unit volume for air at 288.15K and 1013mb (sea level -45 celsius)

      // optical length at zenith for molecules
      const float rayleighZenithLength = 8.4E3;
      const float mieZenithLength = 1.25E3;
      // 66 arc seconds -> degrees, and the cosine of that
      const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;

      // 3.0 / ( 16.0 * pi )
      const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
      // 1.0 / ( 4.0 * pi )
      const float ONE_OVER_FOURPI = 0.07957747154594767;

      float rayleighPhase( float cosTheta ) {
        return THREE_OVER_SIXTEENPI * ( 1.0 + pow( cosTheta, 2.0 ) );
      }

      float hgPhase( float cosTheta, float g ) {
        float g2 = pow( g, 2.0 );
        float inverse = 1.0 / pow( 1.0 - 2.0 * g * cosTheta + g2, 1.5 );
        return ONE_OVER_FOURPI * ( ( 1.0 - g2 ) * inverse );
      }

      void main() {

        vec3 direction = normalize( vWorldPosition - cameraPos );

      // optical length
      // cutoff angle at 90 to avoid singularity in next formula.
        float zenithAngle = acos( max( 0.0, dot( up, direction ) ) );
        float inverse = 1.0 / ( cos( zenithAngle ) + 0.15 * pow( 93.885 - ( ( zenithAngle * 180.0 ) / pi ), -1.253 ) );
        float sR = rayleighZenithLength * inverse;
        float sM = mieZenithLength * inverse;

      // combined extinction factor
        vec3 Fex = exp( -( vBetaR * sR + vBetaM * sM ) );

      // in scattering
        float cosTheta = dot( direction, vSunDirection );

        float rPhase = rayleighPhase( cosTheta * 0.5 + 0.5 );
        vec3 betaRTheta = vBetaR * rPhase;

        float mPhase = hgPhase( cosTheta, mieDirectionalG );
        vec3 betaMTheta = vBetaM * mPhase;

        vec3 Lin = pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * ( 1.0 - Fex ), vec3( 1.5 ) );
        Lin *= mix( vec3( 1.0 ), pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * Fex, vec3( 1.0 / 2.0 ) ), clamp( pow( 1.0 - dot( up, vSunDirection ), 5.0 ), 0.0, 1.0 ) );

      // nightsky
        float theta = acos( direction.y ); // elevation --> y-axis, [-pi/2, pi/2]
        float phi = atan( direction.z, direction.x ); // azimuth --> x-axis [-pi/2, pi/2]
        vec2 uv = vec2( phi, theta ) / vec2( 2.0 * pi, pi ) + vec2( 0.5, 0.0 );
        vec3 L0 = vec3( 0.1 ) * Fex;

      // composition + solar disc
        float sundisk = smoothstep( sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta );
        L0 += ( vSunE * 19000.0 * Fex ) * sundisk;

        vec3 texColor = ( Lin + L0 ) * 0.04 + vec3( 0.0, 0.0003, 0.00075 );

        vec3 retColor = pow( texColor, vec3( 1.0 / ( 1.2 + ( 1.2 * vSunfade ) ) ) );

        gl_FragColor = vec4( retColor, 1.0 );

      #include <tonemapping_fragment>
      #include <${h>=154?`colorspace_fragment`:`encodings_fragment`}>

      }
    `},t=new E({name:`SkyShader`,fragmentShader:e.fragmentShader,vertexShader:e.vertexShader,uniforms:he.clone(e.uniforms),side:1,depthWrite:!1});class n extends se{constructor(){super(new re(1,1,1),t)}}return qe(n,`SkyShader`,e),qe(n,`material`,t),n})(),Ye=new we,P=new w,Xe=class extends ee{constructor(){super(),this.isLineSegmentsGeometry=!0,this.type=`LineSegmentsGeometry`,this.setIndex([0,2,1,2,3,1,2,4,3,4,5,3,4,6,5,6,7,5]),this.setAttribute(`position`,new de([-1,2,0,1,2,0,-1,1,0,1,1,0,-1,0,0,1,0,0,-1,-1,0,1,-1,0],3)),this.setAttribute(`uv`,new de([-1,2,1,2,-1,1,1,1,-1,-1,1,-1,-1,-2,1,-2],2))}applyMatrix4(e){let t=this.attributes.instanceStart,n=this.attributes.instanceEnd;return t!==void 0&&(t.applyMatrix4(e),n.applyMatrix4(e),t.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}setPositions(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));let n=new x(t,6,1);return this.setAttribute(`instanceStart`,new k(n,3,0)),this.setAttribute(`instanceEnd`,new k(n,3,3)),this.computeBoundingBox(),this.computeBoundingSphere(),this}setColors(e,t=3){let n;e instanceof Float32Array?n=e:Array.isArray(e)&&(n=new Float32Array(e));let r=new x(n,t*2,1);return this.setAttribute(`instanceColorStart`,new k(r,t,0)),this.setAttribute(`instanceColorEnd`,new k(r,t,t)),this}fromWireframeGeometry(e){return this.setPositions(e.attributes.position.array),this}fromEdgesGeometry(e){return this.setPositions(e.attributes.position.array),this}fromMesh(e){return this.fromWireframeGeometry(new g(e.geometry)),this}fromLineSegments(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new we);let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;e!==void 0&&t!==void 0&&(this.boundingBox.setFromBufferAttribute(e),Ye.setFromBufferAttribute(t),this.boundingBox.union(Ye))}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new ye),this.boundingBox===null&&this.computeBoundingBox();let e=this.attributes.instanceStart,t=this.attributes.instanceEnd;if(e!==void 0&&t!==void 0){let n=this.boundingSphere.center;this.boundingBox.getCenter(n);let r=0;for(let i=0,a=e.count;i<a;i++)P.fromBufferAttribute(e,i),r=Math.max(r,n.distanceToSquared(P)),P.fromBufferAttribute(t,i),r=Math.max(r,n.distanceToSquared(P));this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error(`THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.`,this)}}toJSON(){}applyMatrix(e){return console.warn(`THREE.LineSegmentsGeometry: applyMatrix() has been renamed to applyMatrix4().`),this.applyMatrix4(e)}},Ze=class extends Xe{constructor(){super(),this.isLineGeometry=!0,this.type=`LineGeometry`}setPositions(e){let t=e.length-3,n=new Float32Array(2*t);for(let r=0;r<t;r+=3)n[2*r]=e[r],n[2*r+1]=e[r+1],n[2*r+2]=e[r+2],n[2*r+3]=e[r+3],n[2*r+4]=e[r+4],n[2*r+5]=e[r+5];return super.setPositions(n),this}setColors(e,t=3){let n=e.length-t,r=new Float32Array(2*n);if(t===3)for(let i=0;i<n;i+=t)r[2*i]=e[i],r[2*i+1]=e[i+1],r[2*i+2]=e[i+2],r[2*i+3]=e[i+3],r[2*i+4]=e[i+4],r[2*i+5]=e[i+5];else for(let i=0;i<n;i+=t)r[2*i]=e[i],r[2*i+1]=e[i+1],r[2*i+2]=e[i+2],r[2*i+3]=e[i+3],r[2*i+4]=e[i+4],r[2*i+5]=e[i+5],r[2*i+6]=e[i+6],r[2*i+7]=e[i+7];return super.setColors(r,t),this}fromLine(e){let t=e.geometry;return this.setPositions(t.attributes.position.array),this}},Qe=class extends E{constructor(e){super({type:`LineMaterial`,uniforms:he.clone(he.merge([m.common,m.fog,{worldUnits:{value:1},linewidth:{value:1},resolution:{value:new Ue(1,1)},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}}])),vertexShader:`
				#include <common>
				#include <fog_pars_vertex>
				#include <logdepthbuf_pars_vertex>
				#include <clipping_planes_pars_vertex>

				uniform float linewidth;
				uniform vec2 resolution;

				attribute vec3 instanceStart;
				attribute vec3 instanceEnd;

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
						attribute vec4 instanceColorStart;
						attribute vec4 instanceColorEnd;
					#else
						varying vec3 vLineColor;
						attribute vec3 instanceColorStart;
						attribute vec3 instanceColorEnd;
					#endif
				#endif

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#ifdef USE_DASH

					uniform float dashScale;
					attribute float instanceDistanceStart;
					attribute float instanceDistanceEnd;
					varying float vLineDistance;

				#endif

				void trimSegment( const in vec4 start, inout vec4 end ) {

					// trim end segment so it terminates between the camera plane and the near plane

					// conservative estimate of the near plane
					float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
					float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
					float nearEstimate = - 0.5 * b / a;

					float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

					end.xyz = mix( start.xyz, end.xyz, alpha );

				}

				void main() {

					#ifdef USE_COLOR

						vLineColor = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

					#endif

					#ifdef USE_DASH

						vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
						vUv = uv;

					#endif

					float aspect = resolution.x / resolution.y;

					// camera space
					vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
					vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

					#ifdef WORLD_UNITS

						worldStart = start.xyz;
						worldEnd = end.xyz;

					#else

						vUv = uv;

					#endif

					// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
					// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
					// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
					// perhaps there is a more elegant solution -- WestLangley

					bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

					if ( perspective ) {

						if ( start.z < 0.0 && end.z >= 0.0 ) {

							trimSegment( start, end );

						} else if ( end.z < 0.0 && start.z >= 0.0 ) {

							trimSegment( end, start );

						}

					}

					// clip space
					vec4 clipStart = projectionMatrix * start;
					vec4 clipEnd = projectionMatrix * end;

					// ndc space
					vec3 ndcStart = clipStart.xyz / clipStart.w;
					vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

					// direction
					vec2 dir = ndcEnd.xy - ndcStart.xy;

					// account for clip-space aspect ratio
					dir.x *= aspect;
					dir = normalize( dir );

					#ifdef WORLD_UNITS

						// get the offset direction as perpendicular to the view vector
						vec3 worldDir = normalize( end.xyz - start.xyz );
						vec3 offset;
						if ( position.y < 0.5 ) {

							offset = normalize( cross( start.xyz, worldDir ) );

						} else {

							offset = normalize( cross( end.xyz, worldDir ) );

						}

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						float forwardOffset = dot( worldDir, vec3( 0.0, 0.0, 1.0 ) );

						// don't extend the line if we're rendering dashes because we
						// won't be rendering the endcaps
						#ifndef USE_DASH

							// extend the line bounds to encompass  endcaps
							start.xyz += - worldDir * linewidth * 0.5;
							end.xyz += worldDir * linewidth * 0.5;

							// shift the position of the quad so it hugs the forward edge of the line
							offset.xy -= dir * forwardOffset;
							offset.z += 0.5;

						#endif

						// endcaps
						if ( position.y > 1.0 || position.y < 0.0 ) {

							offset.xy += dir * 2.0 * forwardOffset;

						}

						// adjust for linewidth
						offset *= linewidth * 0.5;

						// set the world position
						worldPos = ( position.y < 0.5 ) ? start : end;
						worldPos.xyz += offset;

						// project the worldpos
						vec4 clip = projectionMatrix * worldPos;

						// shift the depth of the projected points so the line
						// segments overlap neatly
						vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
						clip.z = clipPose.z * clip.w;

					#else

						vec2 offset = vec2( dir.y, - dir.x );
						// undo aspect ratio adjustment
						dir.x /= aspect;
						offset.x /= aspect;

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						// endcaps
						if ( position.y < 0.0 ) {

							offset += - dir;

						} else if ( position.y > 1.0 ) {

							offset += dir;

						}

						// adjust for linewidth
						offset *= linewidth;

						// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
						offset /= resolution.y;

						// select end
						vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

						// back to clip space
						offset *= clip.w;

						clip.xy += offset;

					#endif

					gl_Position = clip;

					vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

					#include <logdepthbuf_vertex>
					#include <clipping_planes_vertex>
					#include <fog_vertex>

				}
			`,fragmentShader:`
				uniform vec3 diffuse;
				uniform float opacity;
				uniform float linewidth;

				#ifdef USE_DASH

					uniform float dashOffset;
					uniform float dashSize;
					uniform float gapSize;

				#endif

				varying float vLineDistance;

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#include <common>
				#include <fog_pars_fragment>
				#include <logdepthbuf_pars_fragment>
				#include <clipping_planes_pars_fragment>

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
					#else
						varying vec3 vLineColor;
					#endif
				#endif

				vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

					float mua;
					float mub;

					vec3 p13 = p1 - p3;
					vec3 p43 = p4 - p3;

					vec3 p21 = p2 - p1;

					float d1343 = dot( p13, p43 );
					float d4321 = dot( p43, p21 );
					float d1321 = dot( p13, p21 );
					float d4343 = dot( p43, p43 );
					float d2121 = dot( p21, p21 );

					float denom = d2121 * d4343 - d4321 * d4321;

					float numer = d1343 * d4321 - d1321 * d4343;

					mua = numer / denom;
					mua = clamp( mua, 0.0, 1.0 );
					mub = ( d1343 + d4321 * ( mua ) ) / d4343;
					mub = clamp( mub, 0.0, 1.0 );

					return vec2( mua, mub );

				}

				void main() {

					#include <clipping_planes_fragment>

					#ifdef USE_DASH

						if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

						if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

					#endif

					float alpha = opacity;

					#ifdef WORLD_UNITS

						// Find the closest points on the view ray and the line segment
						vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
						vec3 lineDir = worldEnd - worldStart;
						vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

						vec3 p1 = worldStart + lineDir * params.x;
						vec3 p2 = rayEnd * params.y;
						vec3 delta = p1 - p2;
						float len = length( delta );
						float norm = len / linewidth;

						#ifndef USE_DASH

							#ifdef USE_ALPHA_TO_COVERAGE

								float dnorm = fwidth( norm );
								alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

							#else

								if ( norm > 0.5 ) {

									discard;

								}

							#endif

						#endif

					#else

						#ifdef USE_ALPHA_TO_COVERAGE

							// artifacts appear on some hardware if a derivative is taken within a conditional
							float a = vUv.x;
							float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
							float len2 = a * a + b * b;
							float dlen = fwidth( len2 );

							if ( abs( vUv.y ) > 1.0 ) {

								alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

							}

						#else

							if ( abs( vUv.y ) > 1.0 ) {

								float a = vUv.x;
								float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
								float len2 = a * a + b * b;

								if ( len2 > 1.0 ) discard;

							}

						#endif

					#endif

					vec4 diffuseColor = vec4( diffuse, alpha );
					#ifdef USE_COLOR
						#ifdef USE_LINE_COLOR_ALPHA
							diffuseColor *= vLineColor;
						#else
							diffuseColor.rgb *= vLineColor;
						#endif
					#endif

					#include <logdepthbuf_fragment>

					gl_FragColor = diffuseColor;

					#include <tonemapping_fragment>
					#include <${h>=154?`colorspace_fragment`:`encodings_fragment`}>
					#include <fog_fragment>
					#include <premultiplied_alpha_fragment>

				}
			`,clipping:!0}),this.isLineMaterial=!0,this.onBeforeCompile=function(){this.transparent?this.defines.USE_LINE_COLOR_ALPHA=`1`:delete this.defines.USE_LINE_COLOR_ALPHA},Object.defineProperties(this,{color:{enumerable:!0,get:function(){return this.uniforms.diffuse.value},set:function(e){this.uniforms.diffuse.value=e}},worldUnits:{enumerable:!0,get:function(){return`WORLD_UNITS`in this.defines},set:function(e){e===!0?this.defines.WORLD_UNITS=``:delete this.defines.WORLD_UNITS}},linewidth:{enumerable:!0,get:function(){return this.uniforms.linewidth.value},set:function(e){this.uniforms.linewidth.value=e}},dashed:{enumerable:!0,get:function(){return`USE_DASH`in this.defines},set(e){!!e!=`USE_DASH`in this.defines&&(this.needsUpdate=!0),e===!0?this.defines.USE_DASH=``:delete this.defines.USE_DASH}},dashScale:{enumerable:!0,get:function(){return this.uniforms.dashScale.value},set:function(e){this.uniforms.dashScale.value=e}},dashSize:{enumerable:!0,get:function(){return this.uniforms.dashSize.value},set:function(e){this.uniforms.dashSize.value=e}},dashOffset:{enumerable:!0,get:function(){return this.uniforms.dashOffset.value},set:function(e){this.uniforms.dashOffset.value=e}},gapSize:{enumerable:!0,get:function(){return this.uniforms.gapSize.value},set:function(e){this.uniforms.gapSize.value=e}},opacity:{enumerable:!0,get:function(){return this.uniforms.opacity.value},set:function(e){this.uniforms.opacity.value=e}},resolution:{enumerable:!0,get:function(){return this.uniforms.resolution.value},set:function(e){this.uniforms.resolution.value.copy(e)}},alphaToCoverage:{enumerable:!0,get:function(){return`USE_ALPHA_TO_COVERAGE`in this.defines},set:function(e){!!e!=`USE_ALPHA_TO_COVERAGE`in this.defines&&(this.needsUpdate=!0),e===!0?(this.defines.USE_ALPHA_TO_COVERAGE=``,this.extensions.derivatives=!0):(delete this.defines.USE_ALPHA_TO_COVERAGE,this.extensions.derivatives=!1)}}}),this.setValues(e)}},$e=new N,et=new w,tt=new w,F=new N,I=new N,L=new N,nt=new w,rt=new pe,R=new b,it=new w,z=new we,B=new ye,V=new N,H,U;function at(e,t,n){return V.set(0,0,-t,1).applyMatrix4(e.projectionMatrix),V.multiplyScalar(1/V.w),V.x=U/n.width,V.y=U/n.height,V.applyMatrix4(e.projectionMatrixInverse),V.multiplyScalar(1/V.w),Math.abs(Math.max(V.x,V.y))}function ot(e,t){let n=e.matrixWorld,r=e.geometry,i=r.attributes.instanceStart,a=r.attributes.instanceEnd,o=Math.min(r.instanceCount,i.count);for(let r=0,s=o;r<s;r++){R.start.fromBufferAttribute(i,r),R.end.fromBufferAttribute(a,r),R.applyMatrix4(n);let o=new w,s=new w;H.distanceSqToSegment(R.start,R.end,s,o),s.distanceTo(o)<U*.5&&t.push({point:s,pointOnLine:o,distance:H.origin.distanceTo(s),object:e,face:null,faceIndex:r,uv:null,[We]:null})}}function st(e,t,n){let r=t.projectionMatrix,i=e.material.resolution,a=e.matrixWorld,o=e.geometry,s=o.attributes.instanceStart,c=o.attributes.instanceEnd,l=Math.min(o.instanceCount,s.count),u=-t.near;H.at(1,L),L.w=1,L.applyMatrix4(t.matrixWorldInverse),L.applyMatrix4(r),L.multiplyScalar(1/L.w),L.x*=i.x/2,L.y*=i.y/2,L.z=0,nt.copy(L),rt.multiplyMatrices(t.matrixWorldInverse,a);for(let t=0,o=l;t<o;t++){if(F.fromBufferAttribute(s,t),I.fromBufferAttribute(c,t),F.w=1,I.w=1,F.applyMatrix4(rt),I.applyMatrix4(rt),F.z>u&&I.z>u)continue;if(F.z>u){let e=F.z-I.z,t=(F.z-u)/e;F.lerp(I,t)}else if(I.z>u){let e=I.z-F.z,t=(I.z-u)/e;I.lerp(F,t)}F.applyMatrix4(r),I.applyMatrix4(r),F.multiplyScalar(1/F.w),I.multiplyScalar(1/I.w),F.x*=i.x/2,F.y*=i.y/2,I.x*=i.x/2,I.y*=i.y/2,R.start.copy(F),R.start.z=0,R.end.copy(I),R.end.z=0;let o=R.closestPointToPointParameter(nt,!0);R.at(o,it);let l=S.lerp(F.z,I.z,o),d=l>=-1&&l<=1,f=nt.distanceTo(it)<U*.5;if(d&&f){R.start.fromBufferAttribute(s,t),R.end.fromBufferAttribute(c,t),R.start.applyMatrix4(a),R.end.applyMatrix4(a);let r=new w,i=new w;H.distanceSqToSegment(R.start,R.end,i,r),n.push({point:i,pointOnLine:r,distance:H.origin.distanceTo(i),object:e,face:null,faceIndex:t,uv:null,[We]:null})}}}var ct=class extends se{constructor(e=new Xe,t=new Qe({color:Math.random()*16777215})){super(e,t),this.isLineSegments2=!0,this.type=`LineSegments2`}computeLineDistances(){let e=this.geometry,t=e.attributes.instanceStart,n=e.attributes.instanceEnd,r=new Float32Array(2*t.count);for(let e=0,i=0,a=t.count;e<a;e++,i+=2)et.fromBufferAttribute(t,e),tt.fromBufferAttribute(n,e),r[i]=i===0?0:r[i-1],r[i+1]=r[i]+et.distanceTo(tt);let i=new x(r,2,1);return e.setAttribute(`instanceDistanceStart`,new k(i,1,0)),e.setAttribute(`instanceDistanceEnd`,new k(i,1,1)),this}raycast(e,t){let n=this.material.worldUnits,r=e.camera;r===null&&!n&&console.error(`LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.`);let i=e.params.Line2===void 0?0:e.params.Line2.threshold||0;H=e.ray;let a=this.matrixWorld,o=this.geometry,s=this.material;U=s.linewidth+i,o.boundingSphere===null&&o.computeBoundingSphere(),B.copy(o.boundingSphere).applyMatrix4(a);let c;if(c=n?U*.5:at(r,Math.max(r.near,B.distanceToPoint(H.origin)),s.resolution),B.radius+=c,H.intersectsSphere(B)===!1)return;o.boundingBox===null&&o.computeBoundingBox(),z.copy(o.boundingBox).applyMatrix4(a);let l;l=n?U*.5:at(r,Math.max(r.near,z.distanceToPoint(H.origin)),s.resolution),z.expandByScalar(l),H.intersectsBox(z)!==!1&&(n?ot(this,t):st(this,r,t))}onBeforeRender(e){let t=this.material.uniforms;t&&t.resolution&&(e.getViewport($e),this.material.uniforms.resolution.value.set($e.z,$e.w))}},lt=class extends ct{constructor(e=new Ze,t=new Qe({color:Math.random()*16777215})){super(e,t),this.isLine2=!0,this.type=`Line2`}},W=t(e()),G=W.forwardRef(function({points:e,color:t=16777215,vertexColors:n,linewidth:r,lineWidth:i,segments:a,dashed:o,...s},c){var l;let u=Te(e=>e.size),d=W.useMemo(()=>a?new ct:new lt,[a]),[f]=W.useState(()=>new Qe),p=(n==null||(l=n[0])==null?void 0:l.length)===4?4:3,m=W.useMemo(()=>{let r=a?new Xe:new Ze,i=e.map(e=>{let t=Array.isArray(e);return e instanceof w||e instanceof N?[e.x,e.y,e.z]:e instanceof Ue?[e.x,e.y,0]:t&&e.length===3?[e[0],e[1],e[2]]:t&&e.length===2?[e[0],e[1],0]:e});if(r.setPositions(i.flat()),n){t=16777215;let e=n.map(e=>e instanceof y?e.toArray():e);r.setColors(e.flat(),p)}return r},[e,a,n,p]);return W.useLayoutEffect(()=>{d.computeLineDistances()},[e,d]),W.useLayoutEffect(()=>{o?f.defines.USE_DASH=``:delete f.defines.USE_DASH,f.needsUpdate=!0},[o,f]),W.useEffect(()=>()=>{m.dispose(),f.dispose()},[m]),W.createElement(`primitive`,M({object:d,ref:c},s),W.createElement(`primitive`,{object:m,attach:`geometry`}),W.createElement(`primitive`,M({object:f,attach:`material`,color:t,vertexColors:!!n,resolution:[u.width,u.height],linewidth:r??i??1,dashed:o,transparent:p===4},s)))}),ut=e=>e===Object(e)&&!Array.isArray(e)&&typeof e!=`function`;function dt(e,t){let n=Te(e=>e.gl),r=ae(O,ut(e)?Object.values(e):e);return(0,W.useLayoutEffect)(()=>{t?.(r)},[t]),(0,W.useEffect)(()=>{if(`initTexture`in n){let e=[];Array.isArray(r)?e=r:r instanceof ke?e=[r]:ut(r)&&(e=Object.values(r)),e.forEach(e=>{e instanceof ke&&n.initTexture(e)})}},[n,r]),(0,W.useMemo)(()=>{if(ut(e)){let t={},n=0;for(let i in e)t[i]=r[n++];return t}return r},[e,r])}dt.preload=e=>ae.preload(O,e),dt.clear=e=>ae.clear(O,e);var ft=parseInt(`186`.replace(/\D+/g,``)),pt=(e,t)=>{e.updateRanges[0]=t};function mt(e,t,n=new w){let r=Math.PI*(e-.5),i=2*Math.PI*(t-.5);return n.x=Math.cos(i),n.y=Math.sin(r),n.z=Math.sin(i),n}var ht=W.forwardRef(({inclination:e=.6,azimuth:t=.1,distance:n=1e3,mieCoefficient:r=.005,mieDirectionalG:i=.8,rayleigh:a=.5,turbidity:o=10,sunPosition:s=mt(e,t),...c},l)=>{let u=W.useMemo(()=>new w().setScalar(n),[n]),[d]=W.useState(()=>new Je);return W.createElement(`primitive`,M({object:d,ref:l,"material-uniforms-mieCoefficient-value":r,"material-uniforms-mieDirectionalG-value":i,"material-uniforms-rayleigh-value":a,"material-uniforms-sunPosition-value":s,"material-uniforms-turbidity-value":o,scale:u},c))}),gt=class extends E{constructor(){super({uniforms:{time:{value:0},fade:{value:1}},vertexShader:`
      uniform float time;
      attribute float size;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 0.5);
        gl_PointSize = size * (30.0 / -mvPosition.z) * (3.0 + sin(time + 100.0));
        gl_Position = projectionMatrix * mvPosition;
      }`,fragmentShader:`
      uniform sampler2D pointTexture;
      uniform float fade;
      varying vec3 vColor;
      void main() {
        float opacity = 1.0;
        if (fade == 1.0) {
          float d = distance(gl_PointCoord, vec2(0.5, 0.5));
          opacity = 1.0 / (1.0 + exp(16.0 * (d - 0.25)));
        }
        gl_FragColor = vec4(vColor, opacity);

        #include <tonemapping_fragment>
	      #include <${ft>=154?`colorspace_fragment`:`encodings_fragment`}>
      }`})}},_t=e=>new w().setFromSpherical(new Pe(e,Math.acos(1-Math.random()*2),Math.random()*2*Math.PI)),vt=W.forwardRef(({radius:e=100,depth:t=50,count:n=5e3,saturation:r=0,factor:i=4,fade:a=!1,speed:o=1},s)=>{let c=W.useRef(null),[l,u,d]=W.useMemo(()=>{let a=[],o=[],s=Array.from({length:n},()=>(.5+.5*Math.random())*i),c=new y,l=e+t,u=t/n;for(let e=0;e<n;e++)l-=u*Math.random(),a.push(..._t(l).toArray()),c.setHSL(e/n,r,.9),o.push(c.r,c.g,c.b);return[new Float32Array(a),new Float32Array(o),new Float32Array(s)]},[n,t,i,e,r]);_(e=>c.current&&(c.current.uniforms.time.value=e.clock.elapsedTime*o));let[f]=W.useState(()=>new gt);return W.createElement(`points`,{ref:s},W.createElement(`bufferGeometry`,null,W.createElement(`bufferAttribute`,{attach:`attributes-position`,args:[l,3]}),W.createElement(`bufferAttribute`,{attach:`attributes-color`,args:[u,3]}),W.createElement(`bufferAttribute`,{attach:`attributes-size`,args:[d,1]})),W.createElement(`primitive`,{ref:c,object:f,attach:`material`,blending:2,"uniforms-fade-value":a,depthWrite:!1,transparent:!0,vertexColors:!0}))}),yt=`https://rawcdn.githack.com/pmndrs/drei-assets/9225a9f1fbd449d9411125c2f419b843d0308c9f/cloud.png`,bt=new pe,K=new w,q=new T,xt=new w,St=new T,J=new w,Ct=W.createContext(null),wt=W.forwardRef(({children:e,material:t=Re,texture:n=yt,range:r,limit:i=200,frustumCulled:a,...o},s)=>{let c=W.useMemo(()=>class extends t{constructor(){super();let e=parseInt(`186`.replace(/\D+/g,``))>=154?`opaque_fragment`:`output_fragment`;this.onBeforeCompile=t=>{t.vertexShader=`attribute float cloudOpacity;
               varying float vOpacity;
              `+t.vertexShader.replace(`#include <fog_vertex>`,`#include <fog_vertex>
                 vOpacity = cloudOpacity;
                `),t.fragmentShader=`varying float vOpacity;
              `+t.fragmentShader.replace(`#include <${e}>`,`#include <${e}>
                 gl_FragColor = vec4(outgoingLight, diffuseColor.a * vOpacity);
                `)}}},[t]);v({CloudMaterial:c});let l=W.useRef(null),u=W.useRef([]),d=W.useMemo(()=>new Float32Array(Array.from({length:i},()=>1)),[i]),f=W.useMemo(()=>new Float32Array(Array.from({length:i},()=>[1,1,1]).flat()),[i]),p=dt(n),m=0,h=0,g,ee=new T,te=new w(0,0,1),y=new w;_((e,t)=>{for(m=e.clock.elapsedTime,bt.copy(l.current.matrixWorld).invert(),e.camera.matrixWorld.decompose(xt,St,J),h=0;h<u.current.length;h++)g=u.current[h],g.ref.current.matrixWorld.decompose(K,q,J),K.add(y.copy(g.position).applyQuaternion(q).multiply(J)),q.copy(St).multiply(ee.setFromAxisAngle(te,g.rotation+=t*g.rotationFactor)),J.multiplyScalar(g.volume+(1+Math.sin(m*g.density*g.speed))/2*g.growth),g.matrix.compose(K,q,J).premultiply(bt),g.dist=K.distanceTo(xt);for(u.current.sort((e,t)=>t.dist-e.dist),h=0;h<u.current.length;h++)g=u.current[h],d[h]=g.opacity*(g.dist<g.fade-1?g.dist/g.fade:1),l.current.setMatrixAt(h,g.matrix),l.current.setColorAt(h,g.color);l.current.geometry.attributes.cloudOpacity.needsUpdate=!0,l.current.instanceMatrix.needsUpdate=!0,l.current.instanceColor&&(l.current.instanceColor.needsUpdate=!0)}),W.useLayoutEffect(()=>{let e=Math.min(i,r===void 0?i:r,u.current.length);l.current.count=e,pt(l.current.instanceMatrix,{start:0,count:e*16}),l.current.instanceColor&&pt(l.current.instanceColor,{start:0,count:e*3}),pt(l.current.geometry.attributes.cloudOpacity,{start:0,count:e})});let b=[p.image.width??1,p.image.height??1],x=Math.max(b[0],b[1]);return b=[b[0]/x,b[1]/x],W.createElement(`group`,M({ref:s},o),W.createElement(Ct.Provider,{value:u},e,W.createElement(`instancedMesh`,{matrixAutoUpdate:!1,ref:l,args:[null,null,i],frustumCulled:a},W.createElement(`instancedBufferAttribute`,{usage:fe,attach:`instanceColor`,args:[f,3]}),W.createElement(`planeGeometry`,{args:[...b]},W.createElement(`instancedBufferAttribute`,{usage:fe,attach:`attributes-cloudOpacity`,args:[d,1]})),W.createElement(`cloudMaterial`,{key:t.name,map:p,transparent:!0,depthWrite:!1}))))}),Tt=W.forwardRef(({opacity:e=1,speed:t=0,bounds:n=[5,1,1],segments:r=20,color:i=`#ffffff`,fade:a=10,volume:o=6,smallestVolume:s=.25,distribute:c=null,growth:l=4,concentrate:u=`inside`,seed:d=Math.random(),...f},p)=>{function m(){let e=Math.sin(d++)*1e4;return e-Math.floor(e)}let h=W.useContext(Ct),g=W.useRef(null),_=W.useId(),v=W.useMemo(()=>[...Array(r)].map((e,t)=>({segments:r,bounds:new w(1,1,1),position:new w,uuid:_,index:t,ref:g,dist:0,matrix:new pe,color:new y,rotation:Math.PI/r*t})),[r,_]);return W.useLayoutEffect(()=>{v.forEach((d,f)=>{ue(d,{volume:o,color:i,speed:t,growth:l,opacity:e,fade:a,bounds:n,density:Math.max(.5,m()),rotationFactor:Math.max(.2,.5*m())*t});let p=c?.(d,f);(p||r>1)&&d.position.copy(d.bounds).multiply(p?.point??{x:m()*2-1,y:m()*2-1,z:m()*2-1});let h=Math.abs(d.position.x),g=Math.abs(d.position.y),_=Math.abs(d.position.z),v=Math.max(h,g,_);d.length=1,h===v&&(d.length-=h/d.bounds.x),g===v&&(d.length-=g/d.bounds.y),_===v&&(d.length-=_/d.bounds.z),d.volume=(p?.volume===void 0?Math.max(Math.max(0,s),u===`random`?m():u===`inside`?d.length:1-d.length):p.volume)*o})},[u,n,a,i,e,l,o,d,r,t]),W.useLayoutEffect(()=>{let e=v;return h.current=[...h.current,...e],()=>{h.current=h.current.filter(e=>e.uuid!==_)}},[v]),W.useImperativeHandle(p,()=>g.current,[]),W.createElement(`group`,M({ref:g},f))}),Et=W.forwardRef((e,t)=>W.useContext(Ct)?W.createElement(Tt,M({ref:t},e)):W.createElement(wt,null,W.createElement(Tt,M({ref:t},e)))),Y=null,Dt=/swiftshader|llvmpipe|software|basic render|softpipe/i;function Ot(){if(Y)return Y;let e=`không rõ`;try{let t=document.createElement(`canvas`),n=t.getContext(`webgl2`)??t.getContext(`webgl`);if(!n)return Y={software:!0,renderer:`không có WebGL`},Y;let r=n.getExtension(`WEBGL_debug_renderer_info`);e=String(r?n.getParameter(r.UNMASKED_RENDERER_WEBGL):n.getParameter(n.RENDERER)),n.getExtension(`WEBGL_lose_context`)?.loseContext()}catch{}return Y={software:Dt.test(e),renderer:e},Y}var X=r();function kt(){return(0,W.useMemo)(()=>({aluminium:new A({color:`#c9cfd6`,metalness:.9,roughness:.35}),darkMetal:new A({color:`#2b2f36`,metalness:.7,roughness:.45}),tableTop:new A({color:`#e9e6df`,roughness:.7}),laptopShell:new je({color:`#3a3f47`,metalness:.6,roughness:.35,clearcoat:.4}),screen:new p({map:ge(),toneMapped:!1}),canopy:new A({color:`#1f5fa8`,roughness:.85,side:2}),coneOrange:new A({color:`#ff6a13`,roughness:.55}),coneWhite:new A({color:`#f4f4f2`,roughness:.3,metalness:.1}),rubber:new A({color:`#1d1f24`,roughness:.9}),skin:new A({color:`#c8906a`,roughness:.7}),shirt:new A({color:`#2e6fd1`,roughness:.8}),pants:new A({color:`#2b2f3a`,roughness:.85}),vest:new A({color:`#c6f032`,roughness:.6,emissive:`#3a4a00`,emissiveIntensity:.25}),rc:new A({color:`#1a1c21`,roughness:.5,metalness:.2}),sock:new A({map:Me(),roughness:.8,side:2}),caseMat:new A({color:`#d3462b`,roughness:.6})}),[])}function At({m:e}){return(0,X.jsxs)(`group`,{children:[(0,X.jsx)(`mesh`,{position:[0,.74,0],material:e.tableTop,castShadow:!0,receiveShadow:!0,children:(0,X.jsx)(`boxGeometry`,{args:[1.2,.03,.62]})}),[[-.55,-.28],[.55,-.28],[-.55,.28],[.55,.28]].map(([t,n])=>(0,X.jsx)(`mesh`,{position:[t,.37,n],material:e.aluminium,castShadow:!0,children:(0,X.jsx)(`cylinderGeometry`,{args:[.014,.014,.74,8]})},`${t}${n}`))]})}function jt({m:e}){return(0,X.jsxs)(`group`,{position:[.05,.755,.02],children:[(0,X.jsx)(`mesh`,{position:[0,.008,0],material:e.laptopShell,castShadow:!0,children:(0,X.jsx)(`boxGeometry`,{args:[.36,.016,.25]})}),(0,X.jsxs)(`mesh`,{position:[0,.0165,.02],rotation:[-Math.PI/2,0,0],children:[(0,X.jsx)(`planeGeometry`,{args:[.3,.12]}),(0,X.jsx)(`meshStandardMaterial`,{color:`#15171b`,roughness:.9})]}),(0,X.jsxs)(`group`,{position:[0,.016,-.12],rotation:[-.28,0,0],children:[(0,X.jsx)(`mesh`,{position:[0,.12,0],material:e.laptopShell,castShadow:!0,children:(0,X.jsx)(`boxGeometry`,{args:[.36,.24,.01]})}),(0,X.jsx)(`mesh`,{position:[0,.12,.0056],material:e.screen,children:(0,X.jsx)(`planeGeometry`,{args:[.33,.21]})})]})]})}function Mt({m:e}){let t=(0,W.useRef)(null);return _(({clock:e})=>{t.current&&t.current.color.setScalar(e.elapsedTime%1<.1?6:.4).multiply(new y(.3,1,.5))}),(0,X.jsxs)(`group`,{children:[[0,1,2].map(t=>{let n=t/3*Math.PI*2;return(0,X.jsx)(`mesh`,{position:[Math.cos(n)*.22,.45,Math.sin(n)*.22],rotation:[Math.sin(n)*.45,0,-Math.cos(n)*.45],material:e.darkMetal,castShadow:!0,children:(0,X.jsx)(`cylinderGeometry`,{args:[.012,.012,1,6]})},t)}),(0,X.jsx)(`mesh`,{position:[0,1.35,0],material:e.aluminium,castShadow:!0,children:(0,X.jsx)(`cylinderGeometry`,{args:[.018,.018,1.8,8]})}),(0,X.jsx)(`mesh`,{position:[0,2.28,0],material:e.rc,castShadow:!0,children:(0,X.jsx)(`boxGeometry`,{args:[.16,.05,.11]})}),[-.06,.06].map(t=>(0,X.jsx)(`mesh`,{position:[t,2.4,-.04],rotation:[0,0,t>0?-.2:.2],material:e.rc,castShadow:!0,children:(0,X.jsx)(`cylinderGeometry`,{args:[.008,.01,.22,8]})},t)),(0,X.jsxs)(`mesh`,{position:[.05,2.28,.056],children:[(0,X.jsx)(`sphereGeometry`,{args:[.008,8,6]}),(0,X.jsx)(`meshBasicMaterial`,{ref:t,toneMapped:!1})]})]})}function Nt({m:e}){let t=(0,W.useMemo)(()=>{let e=new ne(2.1,.7,4,1,!0);return e.rotateY(Math.PI/4),e},[]);return(0,X.jsxs)(`group`,{children:[[[-1.45,-1.45],[1.45,-1.45],[-1.45,1.45],[1.45,1.45]].map(([t,n])=>(0,X.jsx)(`mesh`,{position:[t,1.05,n],material:e.aluminium,castShadow:!0,children:(0,X.jsx)(`cylinderGeometry`,{args:[.022,.022,2.1,8]})},`${t}${n}`)),(0,X.jsx)(`mesh`,{geometry:t,position:[0,2.45,0],material:e.canopy,castShadow:!0,receiveShadow:!0}),[0,1,2,3].map(t=>(0,X.jsx)(`mesh`,{position:[Math.sin(t*Math.PI/2)*1.48,2.02,Math.cos(t*Math.PI/2)*1.48],rotation:[0,t*Math.PI/2,0],material:e.canopy,children:(0,X.jsx)(`planeGeometry`,{args:[2.96,.16]})},t))]})}function Pt({m:e}){let t=(0,W.useRef)(null);return _(({clock:e})=>{t.current&&(t.current.rotation.x=-.65+Math.sin(e.elapsedTime*1.3)*.03)}),(0,X.jsxs)(`group`,{children:[[-.1,.1].map(t=>(0,X.jsx)(`mesh`,{position:[t,.45,0],material:e.pants,castShadow:!0,children:(0,X.jsx)(`capsuleGeometry`,{args:[.075,.72,4,10]})},t)),(0,X.jsx)(`mesh`,{position:[0,1.2,0],material:e.shirt,castShadow:!0,children:(0,X.jsx)(`capsuleGeometry`,{args:[.2,.42,6,14]})}),(0,X.jsx)(`mesh`,{position:[0,1.22,0],material:e.vest,castShadow:!0,children:(0,X.jsx)(`cylinderGeometry`,{args:[.215,.215,.44,16,1,!0]})}),(0,X.jsx)(`mesh`,{position:[0,1.66,0],material:e.skin,castShadow:!0,children:(0,X.jsx)(`sphereGeometry`,{args:[.12,20,16]})}),(0,X.jsx)(`mesh`,{position:[0,1.74,0],material:e.caseMat,castShadow:!0,children:(0,X.jsx)(`sphereGeometry`,{args:[.125,18,10,0,Math.PI*2,0,Math.PI/2]})}),(0,X.jsx)(`mesh`,{position:[0,1.73,-.12],rotation:[-.2,0,0],material:e.caseMat,children:(0,X.jsx)(`boxGeometry`,{args:[.18,.012,.1]})}),(0,X.jsxs)(`group`,{ref:t,position:[0,1.36,0],children:[[-.2,.2].map(t=>(0,X.jsx)(`mesh`,{position:[t*.9,-.18,-.08],material:e.shirt,castShadow:!0,children:(0,X.jsx)(`capsuleGeometry`,{args:[.05,.34,4,8]})},t)),(0,X.jsxs)(`group`,{position:[0,-.42,-.16],children:[(0,X.jsx)(`mesh`,{material:e.rc,castShadow:!0,children:(0,X.jsx)(`boxGeometry`,{args:[.2,.12,.05]})}),[-.06,.06].map(t=>(0,X.jsx)(`mesh`,{position:[t,.02,-.03],material:e.aluminium,children:(0,X.jsx)(`cylinderGeometry`,{args:[.006,.006,.04,6]})},t)),(0,X.jsx)(`mesh`,{position:[.07,.1,.01],rotation:[.3,0,0],material:e.rc,children:(0,X.jsx)(`cylinderGeometry`,{args:[.007,.007,.14,6]})})]})]})]})}function Ft({m:e}){return(0,X.jsxs)(`group`,{children:[(0,X.jsx)(`mesh`,{position:[0,.13,0],material:e.caseMat,castShadow:!0,receiveShadow:!0,children:(0,X.jsx)(`boxGeometry`,{args:[.5,.26,.34]})}),(0,X.jsx)(`mesh`,{position:[0,.27,0],material:e.rubber,children:(0,X.jsx)(`boxGeometry`,{args:[.2,.02,.04]})})]})}function It({m:e}){return(0,X.jsxs)(`group`,{children:[(0,X.jsx)(`mesh`,{position:[0,.015,0],material:e.coneOrange,castShadow:!0,receiveShadow:!0,children:(0,X.jsx)(`boxGeometry`,{args:[.36,.03,.36]})}),(0,X.jsx)(`mesh`,{position:[0,.27,0],material:e.coneOrange,castShadow:!0,children:(0,X.jsx)(`cylinderGeometry`,{args:[.03,.14,.5,20]})}),[.22,.36].map(t=>(0,X.jsx)(`mesh`,{position:[0,t,0],material:e.coneWhite,children:(0,X.jsx)(`cylinderGeometry`,{args:[.14-t*.2-.004,.14-(t-.05)*.2-.004,.05,20,1,!0]})},t))]})}function Lt({m:e}){let t=(0,W.useRef)(null),n=(0,W.useMemo)(()=>{let e=new ce(.1,.22,1.1,20,6,!0);return e.rotateZ(Math.PI/2),e.translate(-.55,0,0),e},[]);return _(({clock:e})=>{let n=e.elapsedTime;t.current&&(t.current.rotation.z=-.25+Math.sin(n*1.7)*.08,t.current.rotation.y=Math.sin(n*.9)*.12)}),(0,X.jsxs)(`group`,{rotation:[0,S.degToRad(-20),0],children:[(0,X.jsx)(`mesh`,{position:[0,1.6,0],material:e.aluminium,castShadow:!0,children:(0,X.jsx)(`cylinderGeometry`,{args:[.025,.03,3.2,10]})}),(0,X.jsxs)(`group`,{ref:t,position:[0,3.1,0],children:[(0,X.jsx)(`mesh`,{geometry:n,material:e.sock,castShadow:!0}),(0,X.jsx)(`mesh`,{rotation:[0,0,Math.PI/2],material:e.aluminium,children:(0,X.jsx)(`torusGeometry`,{args:[.22,.012,8,24]})})]})]})}function Rt({labels:e=!0}){let t=kt(),n=l()?.max_distance_home??null,r=n?Array.from({length:12},(e,t)=>t/12*Math.PI*2):[];return(0,X.jsxs)(`group`,{children:[(0,X.jsxs)(`group`,{position:[-7,0,6],rotation:[0,-Math.PI/4,0],children:[(0,X.jsx)(Nt,{m:t}),(0,X.jsx)(At,{m:t}),(0,X.jsx)(jt,{m:t}),(0,X.jsx)(`group`,{position:[1.1,0,.9],children:(0,X.jsx)(Ft,{m:t})}),(0,X.jsx)(`group`,{position:[-1.9,0,-.4],children:(0,X.jsx)(Mt,{m:t})}),e?(0,X.jsx)(j,{id:`field-gcs`,offset:[0,3.2,0],text:`Trạm mặt đất · GCS`}):null]}),(0,X.jsxs)(`group`,{position:[-4.2,0,3.6],rotation:[0,Math.atan2(4.2,-3.6)+Math.PI,0],children:[(0,X.jsx)(Pt,{m:t}),e?(0,X.jsx)(j,{id:`field-operator`,offset:[0,2.1,0],text:`Người vận hành · cầm RC`}):null]}),(0,X.jsx)(`group`,{position:[6.5,0,5],children:(0,X.jsx)(Lt,{m:t})}),[0,1,2,3].map(e=>{let n=e/4*Math.PI*2+Math.PI/4;return(0,X.jsx)(`group`,{position:[Math.cos(n)*2.4,0,Math.sin(n)*2.4],children:(0,X.jsx)(It,{m:t})},`pad-${e}`)}),n?r.map(e=>(0,X.jsx)(`group`,{position:[Math.cos(e)*n,0,Math.sin(e)*n],children:(0,X.jsx)(It,{m:t})},`fence-${e}`)):null]})}function zt({night:e}){let t=(0,W.useMemo)(()=>Ae(),[]);return(0,X.jsxs)(wt,{texture:t,limit:200,material:Re,children:[(0,X.jsx)(Et,{seed:3,segments:30,bounds:[60,6,60],volume:30,position:[-60,55,-120],color:e?`#3b4458`:`#ffffff`,opacity:.75,speed:.05}),(0,X.jsx)(Et,{seed:7,segments:24,bounds:[50,5,40],volume:24,position:[90,60,-60],color:e?`#343c4f`:`#f3f6fb`,opacity:.7,speed:.04}),(0,X.jsx)(Et,{seed:11,segments:20,bounds:[40,5,40],volume:20,position:[20,70,140],color:e?`#2e3546`:`#ffffff`,opacity:.65,speed:.03})]})}var Z=new Ce,Bt=new y;function Vt(e){return(0,W.useMemo)(()=>{let t=Ie(20260925),n=[],r=Array.from({length:9},()=>({a:t()*Math.PI*2,d:e+12+t()*50}));for(let e of r){let r=10+Math.floor(t()*14);for(let i=0;i<r;i++){let r=e.a+(t()-.5)*.35,i=e.d+(t()-.5)*22;n.push({x:Math.cos(r)*i,z:Math.sin(r)*i,h:4+t()*7,conifer:t()<.45,hue:t()})}}for(let r=0;r<60;r++){let r=t()*Math.PI*2,i=e+6+t()*90;n.push({x:Math.cos(r)*i,z:Math.sin(r)*i,h:3+t()*6,conifer:t()<.3,hue:t()})}return n},[e])}function Ht({innerR:e}){let t=Vt(e),n=(0,W.useRef)(null),r=(0,W.useRef)(null),i=(0,W.useRef)(null),a=(0,W.useMemo)(()=>t.filter(e=>!e.conifer),[t]),o=(0,W.useMemo)(()=>t.filter(e=>e.conifer),[t]);return(0,W.useLayoutEffect)(()=>{t.forEach((e,t)=>{Z.position.set(e.x,e.h*.2,e.z),Z.rotation.set(0,e.hue*6.28,0),Z.scale.set(e.h*.035,e.h*.4,e.h*.035),Z.updateMatrix(),n.current?.setMatrixAt(t,Z.matrix)}),a.forEach((e,t)=>{Z.position.set(e.x,e.h*.62,e.z),Z.rotation.set(e.hue*2,e.hue*6.28,0),Z.scale.set(e.h*.34,e.h*.3,e.h*.34),Z.updateMatrix(),r.current?.setMatrixAt(t,Z.matrix),r.current?.setColorAt(t,Bt.setHSL(.22+e.hue*.08,.45,.2+e.hue*.1))}),o.forEach((e,t)=>{Z.position.set(e.x,e.h*.55,e.z),Z.rotation.set(0,e.hue*6.28,0),Z.scale.set(e.h*.22,e.h*.85,e.h*.22),Z.updateMatrix(),i.current?.setMatrixAt(t,Z.matrix),i.current?.setColorAt(t,Bt.setHSL(.36+e.hue*.05,.4,.14+e.hue*.07))});for(let e of[n.current,r.current,i.current])e&&(e.instanceMatrix.needsUpdate=!0,e.instanceColor&&(e.instanceColor.needsUpdate=!0),e.computeBoundingSphere())},[t,a,o]),(0,X.jsxs)(`group`,{children:[(0,X.jsxs)(`instancedMesh`,{ref:n,args:[void 0,void 0,t.length],castShadow:!0,children:[(0,X.jsx)(`cylinderGeometry`,{args:[.7,1,1,6]}),(0,X.jsx)(`meshStandardMaterial`,{color:`#4a3526`,roughness:.95})]}),(0,X.jsxs)(`instancedMesh`,{ref:r,args:[void 0,void 0,a.length],castShadow:!0,children:[(0,X.jsx)(`icosahedronGeometry`,{args:[1,1]}),(0,X.jsx)(`meshStandardMaterial`,{flatShading:!0,roughness:.9})]}),(0,X.jsxs)(`instancedMesh`,{ref:i,args:[void 0,void 0,o.length],castShadow:!0,children:[(0,X.jsx)(`coneGeometry`,{args:[1,1,7,3]}),(0,X.jsx)(`meshStandardMaterial`,{flatShading:!0,roughness:.9})]})]})}function Ut({night:e}){let t=(0,W.useMemo)(()=>{let e=Ie(42),t=[e()*6.28,e()*6.28,e()*6.28],n=[],r=[];for(let i=0;i<=160;i++){let a=i/160*Math.PI*2,o=14+12*Math.sin(a*3+t[0])+7*Math.sin(a*7+t[1])+4*Math.sin(a*13+t[2])+e()*3,s=Math.cos(a),c=Math.sin(a);if(n.push(s*330,-1,c*330,s*850*.5,Math.max(o,3),c*850*.5,s*520,o*.6,c*520),i<160){let e=i*3;for(let[t,n]of[[0,1],[1,2]])r.push(e+t,e+n,e+3+t,e+n,e+3+n,e+3+t)}}let i=new oe;return i.setAttribute(`position`,new de(n,3)),i.setIndex(r),i.computeVertexNormals(),i},[]);return(0,W.useLayoutEffect)(()=>()=>t.dispose(),[t]),(0,X.jsx)(`mesh`,{geometry:t,children:(0,X.jsx)(`meshStandardMaterial`,{color:e?`#141c22`:`#4f6a4c`,flatShading:!0,roughness:1,side:2})})}function Q({x:e,z:t}){return(0,X.jsxs)(`group`,{position:[e,.36,t],rotation:[Math.PI/2,0,0],children:[(0,X.jsxs)(`mesh`,{castShadow:!0,children:[(0,X.jsx)(`cylinderGeometry`,{args:[.36,.36,.26,20]}),(0,X.jsx)(`meshStandardMaterial`,{color:`#17191d`,roughness:.9})]}),(0,X.jsxs)(`mesh`,{position:[0,t>0?.135:-.135,0],children:[(0,X.jsx)(`cylinderGeometry`,{args:[.2,.2,.02,12]}),(0,X.jsx)(`meshStandardMaterial`,{color:`#9aa3ad`,metalness:.85,roughness:.3})]})]})}function Wt({night:e}){let t=(0,W.useMemo)(()=>new je({color:`#e8e9ea`,metalness:.4,roughness:.35,clearcoat:1,clearcoatRoughness:.15}),[]),n=(0,W.useMemo)(()=>new je({color:`#1b2733`,metalness:.2,roughness:.05,transparent:!0,opacity:.85}),[]);return(0,X.jsxs)(`group`,{children:[(0,X.jsx)(`mesh`,{position:[0,.72,0],material:t,castShadow:!0,receiveShadow:!0,children:(0,X.jsx)(`boxGeometry`,{args:[5.2,.7,1.9]})}),(0,X.jsx)(`mesh`,{position:[.75,1.42,0],material:t,castShadow:!0,children:(0,X.jsx)(`boxGeometry`,{args:[2.1,.75,1.8]})}),(0,X.jsx)(`mesh`,{position:[1.82,1.42,0],rotation:[0,0,-.35],material:n,children:(0,X.jsx)(`boxGeometry`,{args:[.06,.7,1.7]})}),[-1,1].map(e=>(0,X.jsx)(`mesh`,{position:[.75,1.45,e*.905],material:n,children:(0,X.jsx)(`boxGeometry`,{args:[1.7,.5,.02]})},e)),[-1,1].map(e=>(0,X.jsx)(`mesh`,{position:[-1.55,1.2,e*.9],material:t,castShadow:!0,children:(0,X.jsx)(`boxGeometry`,{args:[2,.28,.08]})},`w${e}`)),(0,X.jsxs)(`mesh`,{position:[-1.8,1.25,0],castShadow:!0,children:[(0,X.jsx)(`boxGeometry`,{args:[.9,.35,1.3]}),(0,X.jsx)(`meshStandardMaterial`,{color:`#343a42`,metalness:.5,roughness:.5})]}),[-.65,.65].map(t=>(0,X.jsxs)(`group`,{children:[(0,X.jsxs)(`mesh`,{position:[2.61,.85,t],children:[(0,X.jsx)(`boxGeometry`,{args:[.03,.14,.34]}),(0,X.jsx)(`meshBasicMaterial`,{color:e?[6,5.6,4.8]:`#e9eef2`,toneMapped:!1})]}),(0,X.jsxs)(`mesh`,{position:[-2.61,.9,t*1.2],children:[(0,X.jsx)(`boxGeometry`,{args:[.03,.22,.12]}),(0,X.jsx)(`meshBasicMaterial`,{color:e?[4,.2,.15]:`#a8231c`,toneMapped:!1})]})]},t)),(0,X.jsx)(Q,{x:1.6,z:.88}),(0,X.jsx)(Q,{x:1.6,z:-.88}),(0,X.jsx)(Q,{x:-1.6,z:.88}),(0,X.jsx)(Q,{x:-1.6,z:-.88})]})}function Gt(){return(0,X.jsxs)(`group`,{children:[(0,X.jsxs)(`mesh`,{position:[0,.3,0],castShadow:!0,receiveShadow:!0,children:[(0,X.jsx)(`boxGeometry`,{args:[.7,.5,.5]}),(0,X.jsx)(`meshStandardMaterial`,{color:`#d8b227`,roughness:.55,metalness:.2})]}),[-.36,.36].map(e=>[-.26,.26].map(t=>(0,X.jsxs)(`mesh`,{position:[e,.32,t],children:[(0,X.jsx)(`cylinderGeometry`,{args:[.018,.018,.64,8]}),(0,X.jsx)(`meshStandardMaterial`,{color:`#1f2227`,metalness:.7,roughness:.4})]},`${e}${t}`))),Array.from({length:6},(e,t)=>(0,X.jsxs)(`mesh`,{position:[.352,.2+t*.045,0],children:[(0,X.jsx)(`boxGeometry`,{args:[.01,.018,.34]}),(0,X.jsx)(`meshStandardMaterial`,{color:`#2a2c30`})]},t))]})}function Kt({night:e,aim:t}){return(0,X.jsxs)(`group`,{children:[(0,X.jsxs)(`mesh`,{position:[0,.25,0],castShadow:!0,children:[(0,X.jsx)(`boxGeometry`,{args:[1.2,.5,.8]}),(0,X.jsx)(`meshStandardMaterial`,{color:`#f0f0ec`,roughness:.6})]}),(0,X.jsxs)(`mesh`,{position:[0,3.2,0],castShadow:!0,children:[(0,X.jsx)(`cylinderGeometry`,{args:[.06,.09,5.6,10]}),(0,X.jsx)(`meshStandardMaterial`,{color:`#b9c0c8`,metalness:.8,roughness:.35})]}),(0,X.jsxs)(`group`,{position:[0,6,0],rotation:[.5,0,0],children:[(0,X.jsxs)(`mesh`,{children:[(0,X.jsx)(`boxGeometry`,{args:[1.3,.08,.1]}),(0,X.jsx)(`meshStandardMaterial`,{color:`#2a2d33`,metalness:.6,roughness:.4})]}),[-.45,-.15,.15,.45].map(t=>(0,X.jsxs)(`mesh`,{position:[t,.1,.02],children:[(0,X.jsx)(`boxGeometry`,{args:[.26,.2,.06]}),(0,X.jsx)(`meshBasicMaterial`,{color:e?[7,6.8,6]:`#c8ccd2`,toneMapped:!1})]},t))]}),e?(0,X.jsx)(`spotLight`,{position:[0,6,0],target:t,angle:.55,penumbra:.8,intensity:220,distance:45,decay:1.6,color:`#fff3de`}):null]})}function qt({night:e}){let t=(0,W.useMemo)(()=>Array.from({length:8},()=>new p({toneMapped:!1})),[]),n=(0,W.useMemo)(()=>new y,[]);return _(({clock:r})=>{let i=r.elapsedTime*1.6;t.forEach((t,r)=>{let a=Math.max(0,Math.cos(i-r/8*Math.PI*2))**6,o=e?.8:.35,s=e?5:1.6;n.setRGB(.25,1,.55).multiplyScalar(o+a*s),t.color.copy(n)})}),(0,X.jsx)(`group`,{children:t.map((e,t)=>{let n=t/8*Math.PI*2;return(0,X.jsxs)(`group`,{position:[Math.cos(n)*1.28,0,Math.sin(n)*1.28],children:[(0,X.jsxs)(`mesh`,{position:[0,.03,0],castShadow:!0,children:[(0,X.jsx)(`cylinderGeometry`,{args:[.045,.055,.045,14]}),(0,X.jsx)(`meshStandardMaterial`,{color:`#26292e`,metalness:.5,roughness:.5})]}),(0,X.jsx)(`mesh`,{position:[0,.045,0],material:e,children:(0,X.jsx)(`sphereGeometry`,{args:[.03,12,8,0,Math.PI*2,0,Math.PI/2]})})]},t)})})}function Jt({night:e}){let t=l()?.max_distance_home??50,n=(0,W.useMemo)(()=>new Ce,[]);return(0,X.jsxs)(`group`,{children:[(0,X.jsx)(`primitive`,{object:n,position:[.5,0,1]}),(0,X.jsx)(Ht,{innerR:Math.max(t+6,30)}),(0,X.jsx)(Ut,{night:e}),(0,X.jsx)(qt,{night:e}),(0,X.jsx)(`group`,{position:[-12.5,0,9.5],rotation:[0,Math.PI*.85,0],children:(0,X.jsx)(Wt,{night:e})}),(0,X.jsx)(`group`,{position:[-9.8,0,3.2],rotation:[0,.4,0],children:(0,X.jsx)(Gt,{})}),(0,X.jsx)(`group`,{position:[-3.5,0,10.5],rotation:[0,Math.PI*.8,0],children:(0,X.jsx)(Kt,{night:e,aim:n})})]})}var Yt=e=>e*Math.PI/180,Xt=e=>e*180/Math.PI;function Zt(e,t,n){let r=2**n;return{x:(t+180)/360*r,y:(1-Math.asinh(Math.tan(Yt(e)))/Math.PI)/2*r}}function Qt(e,t,n){let r=2**n,i=e/r*360-180;return{lat:Xt(Math.atan(Math.sinh(Math.PI*(1-2*t/r)))),lon:i}}function $t(e,t,n,r){let i=Zt(e,t,n),a=Math.floor(i.x),o=Math.floor(i.y),s=[];for(let e=-r;e<=r;e+=1)for(let t=-r;t<=r;t+=1)s.push({x:a+t,y:o+e,z:n});return s}function en(){let e=c(),t=n(e=>e.telemetry?.lat??null),r=n(e=>e.telemetry?.lon??null),[i,a]=(0,W.useState)(null);return!e&&!i&&t!==null&&r!==null&&a({lat:t,lon:r}),(0,W.useMemo)(()=>e?{lat:e[0],lon:e[1]}:i,[e,i])}function tn({origin:e,x:t,y:n,z:r,layer:i,onFail:a}){let[o,s]=(0,W.useState)(null),c=Qt(t,n,r),l=Qt(t+1,n+1,r),[f,,p]=D(e,c.lat,c.lon),[m,,h]=D(e,l.lat,l.lon);return(0,W.useEffect)(()=>{let e=!0,o=new O;o.setCrossOrigin(`anonymous`);let c=d(u(i).base,r,t,n);return o.load(c,t=>{e?(t.colorSpace=De,t.anisotropy=8,s(t)):t.dispose()},void 0,()=>e&&a()),()=>{e=!1}},[t,n,r,i,a]),(0,W.useEffect)(()=>()=>o?.dispose(),[o]),o?(0,X.jsxs)(`mesh`,{position:[(f+m)/2,0,(p+h)/2],rotation:[-Math.PI/2,0,0],children:[(0,X.jsx)(`planeGeometry`,{args:[m-f,h-p]}),(0,X.jsx)(`meshStandardMaterial`,{map:o,roughness:1,metalness:0,envMapIntensity:.25})]}):null}function nn({origin:e,layer:t,radius:n}){let[r,i]=(0,W.useState)(0),a=(0,W.useMemo)(()=>()=>i(e=>e+1),[]),o=(0,W.useMemo)(()=>e&&t!==`grid`?$t(e.lat,e.lon,19,n):[],[e,t,n]),s=(0,W.useMemo)(()=>Fe(),[]);return(0,X.jsxs)(`group`,{children:[(0,X.jsxs)(`mesh`,{rotation:[-Math.PI/2,0,0],position:[0,-.6,0],children:[(0,X.jsx)(`planeGeometry`,{args:[6e3,6e3]}),(0,X.jsx)(`meshStandardMaterial`,{map:s,roughness:1,color:`#8a9a80`})]}),e&&t!==`grid`?o.map(n=>(0,X.jsx)(tn,{origin:e,...n,layer:t,onFail:a},`${t}-${n.x}-${n.y}`)):null,r>0&&r>=o.length&&o.length>0?(0,X.jsx)(j,{id:`ground-fail`,offset:[0,.5,0],text:`Không tải được ảnh mặt đất — đang dùng nền dựng sẵn`}):null]})}function rn(){let e=(0,W.useMemo)(()=>Se(),[]);return(0,X.jsx)(`group`,{children:(0,X.jsxs)(`mesh`,{rotation:[-Math.PI/2,0,0],position:[0,.04,0],receiveShadow:!0,children:[(0,X.jsx)(`circleGeometry`,{args:[1.1,64]}),(0,X.jsx)(`meshStandardMaterial`,{map:e,roughness:.85})]})})}var an=`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vPos;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    vPos = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = mat3(modelMatrix) * normal;
    vViewDir = cameraPosition - world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
    #include <logdepthbuf_vertex>
  }
`,on=`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float uTime;
  uniform float uHeight;
  uniform vec3 uColor;
  varying vec3 vPos;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  vec3 safeNormalize(vec3 v) {
    float l = length(v);
    return l > 1e-6 ? v / l : vec3(0.0, 1.0, 0.0);
  }
  void main() {
    #include <logdepthbuf_fragment>
    float h = clamp(vPos.y / max(uHeight, 0.1) + 0.5, 0.0, 1.0);
    // Viền sáng theo góc nhìn (fresnel) — mép trụ đậm, giữa trong suốt.
    float facing = clamp(abs(dot(safeNormalize(vNormalW), safeNormalize(vViewDir))), 0.0, 1.0);
    float fres = pow(1.0 - facing, 2.2);
    // Vạch ngang chạy lên chậm: đọc được là "tường", không che drone.
    // KHÔNG còn vạch ngang chạy: nhìn từ trong rào ra, các vạch thành sọc vàng
    // cắt ngang bầu trời, trông như lỗi hình (ảnh báo lỗi 25/09/2026). Chỉ còn
    // chân tường sáng, mép trên, và viền fresnel khi nhìn xiên.
    float lines = smoothstep(0.97, 1.0, h) * (0.6 + 0.4 * sin(uTime * 1.5));
    float base = (1.0 - smoothstep(0.0, 0.06, h)) * 0.5;
    // Tường ở xa mờ dần: rào là thông tin phụ, không được lấn bầu trời.
    float dist = length(vViewDir);
    float nearFade = 1.0 - smoothstep(35.0, 160.0, dist) * 0.8;
    float alpha = (0.03 + fres * 0.28 + lines * 0.12 + base) * (1.0 - smoothstep(0.8, 1.0, h) * 0.7) * nearFade;
    gl_FragColor = vec4(uColor, clamp(alpha, 0.0, 1.0));
  }
`;function sn(){let e=l(),t=(0,W.useMemo)(()=>new E({vertexShader:an,fragmentShader:on,transparent:!0,depthWrite:!1,side:2,uniforms:{uTime:{value:0},uHeight:{value:10},uColor:{value:new y(`#f2b53a`)}}}),[]);_((e,n)=>{t.uniforms.uTime.value+=n}),(0,W.useEffect)(()=>()=>t.dispose(),[t]);let n=e?.max_alt??10;if((0,W.useEffect)(()=>{t.uniforms.uHeight.value=n},[t,n]),!e)return null;let r=e.max_distance_home,i=Array.from({length:97},(e,t)=>{let n=t/96*Math.PI*2;return[Math.cos(n)*r,.05,Math.sin(n)*r]});return(0,X.jsxs)(`group`,{children:[(0,X.jsx)(`mesh`,{position:[0,n/2,0],material:t,children:(0,X.jsx)(`cylinderGeometry`,{args:[r,r,n,96,1,!0]})}),(0,X.jsx)(G,{points:i,color:`#f2b53a`,lineWidth:2,dashed:!0,dashSize:2,gapSize:1.5}),(0,X.jsx)(j,{id:`fence-label`,tone:`amber`,offset:[0,n+.8,-r],text:(0,X.jsxs)(X.Fragment,{children:[`Rào phần mềm `,r,` m · trần `,n,` m`,(0,X.jsx)(`br`,{}),(0,X.jsx)(`span`,{className:`text-white/75`,children:`lớp phụ — rào thật là FENCE_* trên FC`})]})})]})}function cn(e,t,n){let r=[],i=0;for(let o of t){let t=o.command??a.NAV_WAYPOINT;if(t===a.NAV_TAKEOFF&&n)r.push({label:`Cất cánh ${o.alt} m`,pos:D(e,n[0],n[1],o.alt),kind:`takeoff`}),i=o.alt;else if(t===a.NAV_WAYPOINT&&(o.lat!==0||o.lon!==0)){let t=Number.isFinite(o.alt)?o.alt:0;r.push({label:`WP${o.seq} · ${t} m`,pos:D(e,o.lat,o.lon,t),kind:`wp`}),i=t}else t===a.NAV_RETURN_TO_LAUNCH&&n&&r.push({label:`Về nhà`,pos:D(e,n[0],n[1],i),kind:`end`})}return r}function ln({y:e,color:t}){let n=(0,W.useRef)(null);return _((e,t)=>{n.current&&(n.current.rotation.y+=t*.6)}),(0,X.jsxs)(`mesh`,{ref:n,position:[0,e,0],children:[(0,X.jsx)(`torusGeometry`,{args:[.9,.05,12,48]}),(0,X.jsx)(`meshStandardMaterial`,{color:t,emissive:t,emissiveIntensity:.8,metalness:.3,roughness:.3,transparent:!0,opacity:.85})]})}function un({origin:e,items:t,kind:n}){let r=c(),i=(0,W.useMemo)(()=>cn(e,t,r?[r[0],r[1]]:null),[e,t,r]);if(i.length===0)return null;let a=n===`draft`?`#f2b53a`:`#3ee6a0`,o=[[0,.05,0],...i.map(e=>e.pos)];return(0,X.jsxs)(`group`,{children:[(0,X.jsx)(G,{points:o,color:a,lineWidth:n===`draft`?2.5:4,dashed:n===`draft`,dashSize:1.2,gapSize:.8}),i.filter(e=>e.kind===`wp`).map(e=>(0,X.jsxs)(`group`,{position:[e.pos[0],0,e.pos[2]],children:[(0,X.jsx)(G,{points:[[0,.05,0],[0,e.pos[1],0]],color:a,lineWidth:1,transparent:!0,opacity:.6}),(0,X.jsx)(ln,{y:e.pos[1],color:a}),(0,X.jsxs)(`mesh`,{position:[0,e.pos[1],0],children:[(0,X.jsx)(`octahedronGeometry`,{args:[n===`draft`?.35:.45,0]}),(0,X.jsx)(`meshStandardMaterial`,{color:a,emissive:a,emissiveIntensity:n===`draft`?.6:1.1,roughness:.35})]}),(0,X.jsxs)(`mesh`,{rotation:[-Math.PI/2,0,0],position:[0,.03,0],children:[(0,X.jsx)(`ringGeometry`,{args:[.35,.5,32]}),(0,X.jsx)(`meshBasicMaterial`,{color:a,transparent:!0,opacity:.7})]}),n===`draft`?(0,X.jsx)(j,{id:`wp-${e.label}`,tone:`amber`,offset:[0,e.pos[1]+.9,0],text:e.label}):null]},`${n}-${e.label}`))]})}function dn({origin:e}){let{items:t}=o(),n=i(e=>e.readback),r=t.some(e=>e.command===a.NAV_WAYPOINT);return(0,X.jsxs)(`group`,{children:[n?(0,X.jsx)(un,{origin:e,items:n.waypoints,kind:`readback`}):null,r?(0,X.jsx)(un,{origin:e,items:t,kind:`draft`}):null]})}function fn({origin:e}){let t=s(700),n=(0,W.useMemo)(()=>{let t=[],n=null;for(let r of f.samples()){let i=r.d;if(!i.armed||i.lat==null||i.lon==null)continue;let a=D(e,i.lat,i.lon,Math.max(0,i.relative_alt??0));n&&Math.hypot(a[0]-n[0],a[1]-n[1],a[2]-n[2])<.4||(t.push(a),n=a)}return t},[e,t]),r=(0,W.useMemo)(()=>n.map((e,t)=>new y().setHSL(.52,.85,.35+.35*(t/Math.max(1,n.length-1)))),[n]);return n.length<2?null:(0,X.jsx)(G,{points:n,vertexColors:r,lineWidth:3})}var pn={OFF:`#3ee6a0`,NEAR:`#f2b53a`,ACTIVE:`#ff5a52`,UNKNOWN:`#8b95a5`};function mn(){let e=l(),t=(0,W.useRef)(null),r=(0,W.useRef)(null),i=(0,W.useRef)(null),a=(0,W.useMemo)(()=>new p({color:`#3ee6a0`,transparent:!0,opacity:.22,depthWrite:!1}),[]),o=(0,W.useMemo)(()=>new p({color:new y(2,2,2),toneMapped:!1}),[]),s=e?.rangefinder_max_m??6;_(()=>{let e=n.getState().telemetry,t=e?.obstacle_distance,c=e?.avoid_state??`UNKNOWN`,l=typeof t==`number`&&Number.isFinite(t),u=l?Math.min(t,s):s;r.current&&(r.current.scale.set(1,u,1),r.current.position.z=-u/2),a.color.set(pn[c]),a.opacity=l?.26:.08,i.current&&(i.current.visible=l&&t<=s,i.current.position.z=-u,o.color.set(pn[c]).multiplyScalar(4))});let c=Math.tan(S.degToRad(1.8));return(0,X.jsxs)(`group`,{ref:t,position:[0,.21,-.12],children:[(0,X.jsx)(`mesh`,{ref:r,rotation:[-Math.PI/2,0,0],material:a,children:(0,X.jsx)(`cylinderGeometry`,{args:[c,.004,1,16,1,!0]})}),(0,X.jsx)(`mesh`,{ref:i,material:o,children:(0,X.jsx)(`sphereGeometry`,{args:[.05,12,10]})})]})}function hn({follow:e}){let t=(0,W.useRef)(null);return _(()=>{t.current&&t.current.position.set(Math.round(e.x),.02,Math.round(e.z))}),(0,X.jsxs)(`mesh`,{ref:t,rotation:[-Math.PI/2,0,0],receiveShadow:!0,children:[(0,X.jsx)(`planeGeometry`,{args:[40,40]}),(0,X.jsx)(`shadowMaterial`,{transparent:!0,opacity:.38})]})}var gn=54,_n=42,vn=4;function yn(){let{geometry:e,edges:t}=(0,W.useMemo)(()=>{let e=Math.tan(S.degToRad(gn/2))*vn,t=Math.tan(S.degToRad(_n/2))*vn,n=new Float32Array([0,0,0,-e,-t,-4,e,-t,-4,e,t,-4,-e,t,-4]),r=new oe;return r.setAttribute(`position`,new ie(n,3)),r.setIndex([0,1,2,0,2,3,0,3,4,0,4,1]),r.computeVertexNormals(),{geometry:r,edges:[[[0,0,0],[-e,-t,-4]],[[0,0,0],[e,-t,-4]],[[0,0,0],[e,t,-4]],[[0,0,0],[-e,t,-4]],[[-e,-t,-4],[e,-t,-4],[e,t,-4],[-e,t,-4],[-e,-t,-4]]]}},[]);return(0,X.jsxs)(`group`,{position:[0,.2,-.1],rotation:[-.26,0,0],children:[(0,X.jsx)(`mesh`,{geometry:e,children:(0,X.jsx)(`meshBasicMaterial`,{color:`#b28cff`,transparent:!0,opacity:.07,depthWrite:!1,side:2})}),t.map((e,t)=>(0,X.jsx)(G,{points:e,color:`#b28cff`,lineWidth:1.2,transparent:!0,opacity:.8},t))]})}var bn={low:{dpr:[1,1],shadows:!1,shadowMap:512,tiles:2,ao:!1,post:!1},medium:{dpr:[1,1.5],shadows:!0,shadowMap:1024,tiles:3,ao:!1,post:!0},high:{dpr:[1,2],shadows:!0,shadowMap:2048,tiles:4,ao:!0,post:!0},ultra:{dpr:[1.25,2],shadows:!0,shadowMap:4096,tiles:5,ao:!0,post:!0}},xn=24;function Sn(e,t=new Date){let n=((e===`noon`?12.3:e===`golden`?17.6:e===`night`?23:t.getHours()+t.getMinutes()/60)-6)/12*Math.PI;return new w(Math.cos(n),Math.max(Math.sin(n),-.3),.35).normalize()}function Cn({timeOfDay:e,shadowMap:t,shadows:n}){let r=(0,W.useMemo)(()=>Sn(e),[e]),i=r.y<.02,a=(0,W.useRef)(null),o=(0,W.useMemo)(()=>new Ce,[]),s=xn/t;return _(()=>{if(!a.current)return;let e=$.position;o.position.set(Math.round(e.x/s)*s,0,Math.round(e.z/s)*s),a.current.position.copy(o.position).addScaledVector(r,60),o.updateMatrixWorld()}),(0,X.jsxs)(X.Fragment,{children:[i?null:(0,X.jsx)(ht,{sunPosition:r.clone().multiplyScalar(100).toArray(),turbidity:6,rayleigh:1.4,mieCoefficient:.006,mieDirectionalG:.85}),i?(0,X.jsx)(vt,{radius:260,depth:60,count:4e3,factor:5,saturation:0,fade:!0,speed:.4}):null,i?(0,X.jsx)(`color`,{attach:`background`,args:[`#060b16`]}):null,(0,X.jsx)(`fog`,{attach:`fog`,args:[i?`#070d1a`:`#b7c9dc`,180,900]}),(0,X.jsx)(`hemisphereLight`,{args:[i?`#28324a`:`#dbe8ff`,i?`#10141c`:`#4a4232`,i?.55:.45]}),(0,X.jsx)(`primitive`,{object:o}),(0,X.jsx)(`directionalLight`,{ref:a,target:o,intensity:i?.55:2.1,color:e===`golden`?`#ffc98a`:i?`#9fb4ff`:`#fff6e8`,castShadow:n,"shadow-mapSize":[t,t],"shadow-bias":-6e-4,"shadow-normalBias":.04,"shadow-camera-near":1,"shadow-camera-far":140,"shadow-camera-left":-12,"shadow-camera-right":xn/2,"shadow-camera-top":xn/2,"shadow-camera-bottom":-12}),(0,X.jsxs)(Ve,{resolution:256,frames:1,children:[(0,X.jsx)(`color`,{attach:`background`,args:[i?`#0a1020`:`#8fb2d6`]}),(0,X.jsx)(C,{form:`rect`,intensity:i?.25:.9,color:`#ffffff`,position:[0,12,0],rotation:[Math.PI/2,0,0],scale:[30,30,1]}),(0,X.jsx)(C,{form:`rect`,intensity:.6,color:`#ffe2c2`,position:[-12,3,-6],rotation:[0,Math.PI/2.5,0],scale:[12,4,1]}),(0,X.jsx)(C,{form:`ring`,intensity:.9,color:`#bfe7ff`,position:[10,5,8],scale:4}),(0,X.jsx)(C,{form:`rect`,intensity:.3,color:`#4a5a3a`,position:[0,-6,0],rotation:[-Math.PI/2,0,0],scale:[40,40,1]})]})]})}var $={position:new w(0,0,0),quaternion:new T,yaw:0,scale:1};function wn({origin:e,showBeam:t,showCamera:r}){let i=(0,W.useRef)(null),a=(0,W.useRef)(null),o=(0,W.useMemo)(()=>new w,[]),s=(0,W.useMemo)(()=>new T,[]),c=(0,W.useMemo)(()=>new te(0,0,0,`YXZ`),[]);return _(({camera:t},r)=>{let l=n.getState().telemetry;if(l&&e&&l.lat!=null&&l.lon!=null){let[t,,n]=D(e,l.lat,l.lon);o.set(t,Math.max(0,l.relative_alt??0),n)}else o.set(0,0,0);let u=l?.yaw??l?.heading??0;c.set(...ve(l?.roll??0,l?.pitch??0,u)),s.setFromEuler(c);let d=1-Math.exp(-r*9);$.position.distanceTo(o)>40?$.position.copy(o):$.position.lerp(o,d),$.quaternion.slerp(s,d),$.yaw=S.degToRad(u);let f=t.position.distanceTo($.position),p=S.clamp(f/14,1,6);$.scale+=(p-$.scale)*d,i.current&&i.current.position.copy($.position),a.current&&(a.current.quaternion.copy($.quaternion),a.current.scale.setScalar($.scale))}),(0,X.jsxs)(`group`,{ref:i,children:[(0,X.jsxs)(`group`,{ref:a,children:[(0,X.jsx)(Le,{spinning:()=>n.getState().telemetry?.armed===!0}),t?(0,X.jsx)(mn,{}):null,r?(0,X.jsx)(yn,{}):null]}),(0,X.jsx)(Tn,{})]})}function Tn(){let e=(0,W.useRef)(null),t=(0,W.useRef)(null);return _(()=>{let n=$.position.y;e.current&&(e.current.visible=n>.4,e.current.scale.set(1,Math.max(.001,n),1),e.current.position.y=-n/2),t.current&&(t.current.position.y=-n+.03,t.current.scale.setScalar(.6+n*.08))}),(0,X.jsxs)(X.Fragment,{children:[(0,X.jsxs)(`mesh`,{ref:e,children:[(0,X.jsx)(`cylinderGeometry`,{args:[.012,.012,1,6]}),(0,X.jsx)(`meshBasicMaterial`,{color:`#5ee0f0`,transparent:!0,opacity:.55})]}),(0,X.jsxs)(`mesh`,{ref:t,rotation:[-Math.PI/2,0,0],children:[(0,X.jsx)(`ringGeometry`,{args:[.8,.9,48]}),(0,X.jsx)(`meshBasicMaterial`,{color:`#5ee0f0`,transparent:!0,opacity:.8,depthWrite:!1})]})]})}function En({mode:e}){let{camera:t}=Te(),n=(0,W.useRef)(null),r=(0,W.useMemo)(()=>new w,[]),i=(0,W.useMemo)(()=>new w,[]),a=(0,W.useMemo)(()=>new w(0,.18,-.15),[]),o=t;return _(({clock:s},c)=>{let l=$.position,u=1-Math.exp(-c*4),d=e===`fpv`?88:45;switch(Math.abs(o.fov-d)>.1&&(o.fov+=(d-o.fov)*Math.min(1,c*6),o.updateProjectionMatrix()),t.up.set(0,1,0),e){case`orbit`:{let e=n.current;e&&(r.copy(l).sub(e.target),e.target.add(r.multiplyScalar(u)),t.position.add(r),e.update());return}case`chase`:{let e=3.2+$.scale*1.2;r.set(-Math.sin($.yaw)*e,1.1+$.scale*.6,Math.cos($.yaw)*e),t.position.lerp(r.add(l),u),i.copy(l).setY(l.y+.3),t.lookAt(i);return}case`top`:r.set(l.x,l.y+38,l.z+.01),t.position.lerp(r,u),t.up.set(0,0,-1),t.lookAt(l);return;case`fpv`:r.copy(a).multiplyScalar($.scale).applyQuaternion($.quaternion).add(l),t.position.copy(r),t.quaternion.copy($.quaternion),t.rotateX(-.26);return;case`cinematic`:{let e=s.elapsedTime*.12,n=7+$.scale*1.5;r.set(l.x+Math.cos(e)*n,l.y+1.8+Math.sin(e*.7)*.8,l.z+Math.sin(e)*n),t.position.lerp(r,u*.6),t.lookAt(l);return}}}),e===`orbit`?(0,X.jsx)(le,{ref:n,makeDefault:!0,enableDamping:!0,dampingFactor:.08,minDistance:1.2,maxDistance:400,maxPolarAngle:Math.PI*.495}):null}var Dn=(0,W.memo)(function({quality:e}){let t=bn[e];return t.post?(0,X.jsxs)(Oe,{multisampling:0,children:[t.ao?(0,X.jsx)(xe,{aoRadius:.6,distanceFalloff:1,intensity:2.2,quality:e===`ultra`?`high`:`medium`,halfRes:e!==`ultra`}):(0,X.jsx)(X.Fragment,{}),(0,X.jsx)(Ne,{mipmapBlur:!0,luminanceThreshold:2.2,luminanceSmoothing:.3,intensity:.8}),(0,X.jsx)(ze,{offset:.25,darkness:.55}),(0,X.jsx)(me,{mode:He.NEUTRAL}),(0,X.jsx)(be,{})]}):null});function On({camera:e=`chase`,quality:t=`high`,ground:n=`satellite`,effects:r=!0,timeOfDay:i=`live`,showMission:a=!0,showGeofence:o=!0,showTrail:s=!0,showBeam:c=!0,showField:l=!0,showCamera:u=!1,showClouds:d=!0,className:f,children:p}){let m=en(),h=(0,W.useMemo)(()=>Ot(),[]);h.software&&(t=`low`,r=!1,l=!1,d=!1);let g=h.software?{...bn.low,dpr:[.6,.6],tiles:1}:bn[t];return(0,X.jsxs)(`div`,{className:f??`relative h-full w-full`,"data-testid":`twin-scene`,children:[(0,X.jsxs)(Be,{shadows:g.shadows?`percentage`:!1,dpr:g.dpr,gl:{antialias:!r||!g.post,powerPreference:`high-performance`,logarithmicDepthBuffer:!0,toneMapping:r&&g.post?0:7},camera:{position:[4,3,6],fov:45,near:.05,far:3e3},className:`!absolute inset-0`,children:[(0,X.jsx)(Ee,{}),(0,X.jsxs)(W.Suspense,{fallback:null,children:[(0,X.jsx)(Cn,{timeOfDay:i,shadowMap:g.shadowMap,shadows:g.shadows}),(0,X.jsx)(nn,{origin:m,layer:n,radius:g.tiles}),(0,X.jsx)(rn,{}),m&&a?(0,X.jsx)(dn,{origin:m}):null,m&&s?(0,X.jsx)(fn,{origin:m}):null,o?(0,X.jsx)(sn,{}):null,(0,X.jsx)(wn,{origin:m,showBeam:c,showCamera:u}),g.shadows?(0,X.jsx)(hn,{follow:$.position}):null,l?(0,X.jsx)(Rt,{}):null,l?(0,X.jsx)(Jt,{night:Sn(i).y<.02}):null,d&&t!==`low`?(0,X.jsx)(zt,{night:Sn(i).y<.02}):null,(0,X.jsx)(En,{mode:e}),r?(0,X.jsx)(Dn,{quality:t}):null]})]}),(0,X.jsx)(_e,{}),h.software?(0,X.jsxs)(`div`,{className:`pointer-events-none absolute bottom-3 left-3 max-w-sm rounded-lg bg-black/70 px-3 py-2 text-[11.5px] leading-snug text-white`,"data-testid":`twin-software-render`,children:[`Máy đang vẽ 3D bằng CPU (`,h.renderer,`) — đã tự hạ chất lượng về Thấp để trang không bị đứng. Bật tăng tốc phần cứng trong trình duyệt để có hình đẹp.`]}):null,p]})}export{On as TwinScene,ft as n,Ot as t};
//# sourceMappingURL=TwinScene-CKgRuNnO.js.map