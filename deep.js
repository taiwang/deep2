"use strict";
{
	const webgl = {
		init() {
			// create webGL canvas context
			this.elem = document.createElement("canvas");
			document.body.appendChild(this.elem);
			const options = { alpha: false };
			const gl = this.gl = this.elem.getContext('webgl', options) || this.elem.getContext('experimental-webgl', options);
			// set shaders
			this.vertexShader = gl.createShader(gl.VERTEX_SHADER);
			gl.shaderSource(
				this.vertexShader,
				`
					uniform mat4 camProj, camView, modelMatrix;
					attribute vec3 aPosition, aNormal, aColor;
					varying vec3 vWPosition, vPosition, vNormal, vColor;
					void main(void) {
						vec4 mpos = modelMatrix * vec4(aPosition, 1.0);
						vec4 wpos = camView * mpos;
						vPosition = wpos.xyz;
						vWPosition = mpos.xyz;
						vNormal = aNormal;
						vColor = aColor;
						gl_Position = camProj * wpos;
					}
				`
			);
			this.fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
			gl.shaderSource(
				this.fragmentShader,
				`
					precision highp float;
					varying vec3 vWPosition, vPosition, vNormal, vColor;
					const vec3 lightPos = vec3(0.0, 0.0, -2.5);
					const vec3 lightColor = vec3(1.3, 1.3, 0.9);
					const vec3 ambientFar = vec3(0.05, 0.1, 0.6);
					const vec3 ambientNear = vec3(0.12, 0.09, 0.02);
					const float radius = 2.5;
					uniform float uTime;
					uniform vec2 uResolution;
					void main(void) {
						float dist = distance(vPosition, lightPos);
						float att = max(1.0 - (dist * dist) / (radius * radius), 0.0);
						vec3 lightDirection = normalize(lightPos - vWPosition);
						float angle = max(dot(lightDirection, vNormal), 0.0);
						vec3 diffuse = att * att * lightColor * vColor * angle;
						vec3 col = ambientFar * angle * att + ambientNear * 1.0 / dist + diffuse;
						if (vColor.r > 9.0) col = vColor;
						vec2 uv = gl_FragCoord.xy / uResolution.xy;
						col -= abs(sin(uv.y * 200.0 - uTime * 3.0)) * 0.02;
						gl_FragColor = vec4(col, 1.0);
					}
				`
			);
			// compile shaders
			gl.compileShader(this.vertexShader);
			gl.compileShader(this.fragmentShader);
			this.program = gl.createProgram();
			gl.attachShader(this.program, this.vertexShader);
			gl.attachShader(this.program, this.fragmentShader);
			gl.linkProgram(this.program);
			gl.useProgram(this.program);
			// camera
			this.camera = {
				proj: this.mat4().uniform("camProj").load(),
				view: this.mat4().uniform("camView").load()
			};
			// resize event
			this.resize();
			window.addEventListener("resize", () => this.resize(), false);
			return gl;
		},
		Attribute: class {
			constructor(name) {
				this.gl = webgl.gl;
				this.index = gl.getAttribLocation(webgl.program, name);
				gl.enableVertexAttribArray(this.index);
				this.buffer = gl.createBuffer();
				this.numElements = 0;
			}
			load(data, size) {
				this.itemSize = size;
				this.bind();
				this.gl.bufferData(
					this.gl.ARRAY_BUFFER,
					data instanceof Array ? new Float32Array(data) : data,
					this.gl.STATIC_DRAW
				);
				this.numElements = data.length / size;
				return this;
			}
			loadIndices(indices) {
				if (!this.indices) this.indices = this.gl.createBuffer();
				this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indices);
				this.gl.bufferData(
					this.gl.ELEMENT_ARRAY_BUFFER,
					indices instanceof Array ? new Uint16Array(indices) : indices,
					this.gl.STATIC_DRAW
				);
				this.numIndices = indices.length;
				return this;
			}
			bind() {
				this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
				if (this.indices) this.gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices);
				this.gl.vertexAttribPointer(
					this.index,
					this.itemSize,
					gl.FLOAT,
					false,
					0,
					0
				);
			}
		},
		resize() {
			this.width = this.elem.width = this.elem.offsetWidth;
			this.height = this.elem.height = this.elem.offsetHeight;
			this.aspect = this.width / this.height;
			if (this.uResolution) this.uResolution.set(this.width, this.height).load();
			// perspective projection
			this.camera.proj.perspective(45).load();
			this.gl.viewport(
				0,
				0,
				this.gl.drawingBufferWidth,
				this.gl.drawingBufferHeight
			);
			// clear screen
			this.gl.clearColor(0, 0, 0, 0);
			this.gl.clear(this.gl.COLOR_BUFFER_BIT);
		},
		mat4() {
			return new this.Mat4();
		},
		float(v) {
			return new this.Float(v);
		},
		vec2(x, y) {
			return new this.Vec2(x, y);
		},
		vec3(x, y, z) {
			return new this.Vec3(x, y, z);
		},
		vec4(x, y, z, w) {
			return new this.Vec4(x, y, z, w);
		},
		Mat4: class {
			constructor() {
				this.matrix = new Float32Array([
					1, 0, 0, 0,
					0, 1, 0, 0,
					0, 0, 1, 0,
					0, 0, 0, 1
				]);
				this.gl = webgl.gl;
				this.u = null;
			}
			identity() {
				const d = this.matrix;
				d[0] = 1;
				d[1] = 0;
				d[2] = 0;
				d[3] = 0;
				d[4] = 0;
				d[5] = 1;
				d[6] = 0;
				d[7] = 0;
				d[8] = 0;
				d[9] = 0;
				d[10] = 1;
				d[11] = 0;
				d[12] = 0;
				d[13] = 0;
				d[14] = 0;
				d[15] = 1;
				return this;
			}
			translate(x, y, z) {
				const d = this.matrix;
				d[12] = d[0] * x + d[4] * y + d[8] * z + d[12];
				d[13] = d[1] * x + d[5] * y + d[9] * z + d[13];
				d[14] = d[2] * x + d[6] * y + d[10] * z + d[14];
				d[15] = d[3] * x + d[7] * y + d[11] * z + d[15];
				return this;
			}
			fromTranslation(x, y, z) {
				const a = this.matrix;
				a[0] = 1;
				a[1] = 0;
				a[2] = 0;
				a[3] = 0;
				a[4] = 0;
				a[5] = 1;
				a[6] = 0;
				a[7] = 0;
				a[8] = 0;
				a[9] = 0;
				a[10] = 1;
				a[11] = 0;
				a[12] = x;
				a[13] = y;
				a[14] = z;
				a[15] = 1;
				return this;
			}
			rotateX(angle) {
				const d = this.matrix;
				const s = Math.sin(angle);
				const c = Math.cos(angle);
				const a10 = d[4];
				const a11 = d[5];
				const a12 = d[6];
				const a13 = d[7];
				const a20 = d[8];
				const a21 = d[9];
				const a22 = d[10];
				const a23 = d[11];
				d[4] = a10 * c + a20 * s;
				d[5] = a11 * c + a21 * s;
				d[6] = a12 * c + a22 * s;
				d[7] = a13 * c + a23 * s;
				d[8] = a10 * -s + a20 * c;
				d[9] = a11 * -s + a21 * c;
				d[10] = a12 * -s + a22 * c;
				d[11] = a13 * -s + a23 * c;
				return this;
			}
			rotateY(angle) {
				const d = this.matrix;
				const s = Math.sin(angle);
				const c = Math.cos(angle);
				const a00 = d[0];
				const a01 = d[1];
				const a02 = d[2];
				const a03 = d[3];
				const a20 = d[8];
				const a21 = d[9];
				const a22 = d[10];
				const a23 = d[11];
				d[0] = a00 * c + a20 * -s;
				d[1] = a01 * c + a21 * -s;
				d[2] = a02 * c + a22 * -s;
				d[3] = a03 * c + a23 * -s;
				d[8] = a00 * s + a20 * c;
				d[9] = a01 * s + a21 * c;
				d[10] = a02 * s + a22 * c;
				d[11] = a03 * s + a23 * c;
				return this;
			}
			rotateZ(angle) {
				const d = this.matrix;
				const s = Math.sin(angle);
				const c = Math.cos(angle);
				const a00 = d[0];
				const a01 = d[1];
				const a02 = d[2];
				const a03 = d[3];
				const a10 = d[4];
				const a11 = d[5];
				const a12 = d[6];
				const a13 = d[7];
				d[0] = a00 * c + a10 * s;
				d[1] = a01 * c + a11 * s;
				d[2] = a02 * c + a12 * s;
				d[3] = a03 * c + a13 * s;
				d[4] = a00 * -s + a10 * c;
				d[5] = a01 * -s + a11 * c;
				d[6] = a02 * -s + a12 * c;
				d[7] = a03 * -s + a13 * c;
				return this;
			}
			scale(x, y, z) {
				const d = this.matrix;
				d[0] *= x;
				d[1] *= x;
				d[2] *= x;
				d[3] *= x;
				d[4] *= y;
				d[5] *= y;
				d[6] *= y;
				d[7] *= y;
				d[8] *= z;
				d[9] *= z;
				d[10] *= z;
				d[11] *= z;
				return this;
			}
			perspective(fov) {
				const d = this.matrix;
				const near = 0.01;
				const far = 100;
				const top = near * Math.tan(fov * Math.PI / 360);
				const right = top * webgl.aspect;
				const left = -right;
				const bottom = -top;
				d[0] = 2 * near / (right - left);
				d[1] = 0;
				d[2] = 0;
				d[3] = 0;
				d[4] = 0;
				d[5] = 2 * near / (top - bottom);
				d[6] = 0;
				d[7] = 0;
				d[8] = (right + left) / (right - left);
				d[9] = (top + bottom) / (top - bottom);
				d[10] = -(far + near) / (far - near);
				d[11] = -1;
				d[12] = 0;
				d[13] = 0;
				d[14] = -(2 * far * near) / (far - near);
				d[15] = 0;
				return this;
			}
			multiply(m1, m2) {
				let b0, b1, b2, b3;
				const d = this.matrix;
				const d1 = m1.matrix;
				const d2 = m2.matrix;
				const a00 = d1[0],
					a01 = d1[1],
					a02 = d1[2],
					a03 = d1[3],
					a10 = d1[4],
					a11 = d1[5],
					a12 = d1[6],
					a13 = d1[7],
					a20 = d1[8],
					a21 = d1[9],
					a22 = d1[10],
					a23 = d1[11],
					a30 = d1[12],
					a31 = d1[13],
					a32 = d1[14],
					a33 = d1[15];
				b0 = d2[0];
				b1 = d2[1];
				b2 = d2[2];
				b3 = d2[3];
				d[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
				d[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
				d[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
				d[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
				b0 = d2[4];
				b1 = d2[5];
				b2 = d2[6];
				b3 = d2[7];
				d[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
				d[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
				d[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
				d[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
				b0 = d2[8];
				b1 = d2[9];
				b2 = d2[10];
				b3 = d2[11];
				d[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
				d[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
				d[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
				d[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
				b0 = d2[12];
				b1 = d2[13];
				b2 = d2[14];
				b3 = d2[15];
				d[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
				d[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
				d[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
				d[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
				return this;
			}
			uniform(uName) {
				this.u = this.gl.getUniformLocation(webgl.program, uName);
				return this;
			}
			load() {
				this.gl.uniformMatrix4fv(this.u, this.gl.FALSE, this.matrix);
				return this;
			}
		},
		Float: class {
			constructor(v = 0.0) {
				this.value = v;
				this.u = null;
				this.gl = webgl.gl;
			}
			set(v) {
				this.value = v;
				return this;
			}
			uniform(uName) {
				this.u = this.gl.getUniformLocation(webgl.program, uName);
				return this;
			}
			load() {
				this.gl.uniform1f(this.u, this.value);
				return this;
			}
		},
		Vec2: class {
			constructor(x = 0.0, y = 0.0) {
				this.x = x;
				this.y = y;
				this.u = null;
				this.gl = webgl.gl;
			}
			set(x, y) {
				this.x = x;
				this.y = y;
				return this;
			}
			uniform(uName) {
				this.u = this.gl.getUniformLocation(webgl.program, uName);
				return this;
			}
			load() {
				this.gl.uniform2f(this.u, this.x, this.y);
				return this;
			}
		},
		Vec3: class {
			constructor(x = 0.0, y = 0.0, z = 0.0) {
				this.x = x;
				this.y = y;
				this.z = z;
				this.u = null;
				this.gl = webgl.gl;
			}
			set(x, y, z) {
				this.x = x;
				this.y = y;
				this.z = z;
				return this;
			}
			copy(v) {
				this.x = v.x;
				this.y = v.y;
				this.z = v.z;
				return this;
			}
			lerp(v, s) {
				this.x += (v.x - this.x) * s;
				this.y += (v.y - this.y) * s;
				this.z += (v.z - this.z) * s;
				return this;
			}
			distance(b) {
				const dx = b.x - this.x;
				const dy = b.y - this.y;
				const dz = b.z - this.z;
				return Math.sqrt(dx * dx + dy * dy + dz * dz);
			}
			transformMat4(v, m) {
				const d = m.matrix;
				const x = v.x;
				const y = v.y;
				const z = v.z;
				const w = d[3] * x + d[7] * y + d[11] * z + d[15] || 1.0;
				this.x = (d[0] * x + d[4] * y + d[8] * z + d[12]) / w;
				this.y = (d[1] * x + d[5] * y + d[9] * z + d[13]) / w;
				this.z = (d[2] * x + d[6] * y + d[10] * z + d[14]) / w;
				return this;
			}
			uniform(uName) {
				this.u = this.gl.getUniformLocation(webgl.program, uName);
				return this;
			}
			load() {
				this.gl.uniform3f(this.u, this.x, this.y, this.z);
				return this;
			}
		},
		Vec4: class {
			constructor(x = 0.0, y = 0.0, z = 0.0, w = 0.0) {
				this.x = x;
				this.y = y;
				this.z = z;
				this.w = w;
				this.u = null;
				this.gl = webgl.gl;
			}
			set(x, y, z, w) {
				this.x = x;
				this.y = y;
				this.z = z;
				this.w = w;
				return this;
			}
			lerp(v, s) {
				this.x += (v.x - this.x) * s;
				this.y += (v.y - this.y) * s;
				this.z += (v.z - this.z) * s;
				this.w += (v.w - this.w) * s;
				return this;
			}
			uniform(uName) {
				this.u = this.gl.getUniformLocation(webgl.program, uName);
				return this;
			}
			load() {
				this.gl.uniform4f(this.u, this.x, this.y, this.z, this.w);
				return this;
			}
		},
		cube: {
			indices(s) {
				return [
					s+0, s+1, s+2,      s+0, s+2, s+3,    // Front face
					s+4, s+5, s+6,      s+4, s+6, s+7,    // Back face
					s+8, s+9, s+10,     s+8, s+10, s+11,  // Top face
					s+12, s+13, s+14,   s+12, s+14, s+15, // Bottom face
					s+16, s+17, s+18,   s+16, s+18, s+19, // Right face
					s+20, s+21, s+22,   s+20, s+22, s+23  // Left face
				]
			},
			normals() {
				return [
					// Front face
					0.0,  0.0,  1.0,
					0.0,  0.0,  1.0,
					0.0,  0.0,  1.0,
					0.0,  0.0,  1.0,
					// Back face
					0.0,  0.0, -1.0,
					0.0,  0.0, -1.0,
					0.0,  0.0, -1.0,
					0.0,  0.0, -1.0,
					// Top face
					0.0,  1.0,  0.0,
					0.0,  1.0,  0.0,
					0.0,  1.0,  0.0,
					0.0,  1.0,  0.0,
					// Bottom face
					0.0, -1.0,  0.0,
					0.0, -1.0,  0.0,
					0.0, -1.0,  0.0,
					0.0, -1.0,  0.0,
					// Right face
					1.0,  0.0,  0.0,
					1.0,  0.0,  0.0,
					1.0,  0.0,  0.0,
					1.0,  0.0,  0.0,
					// Left face
					-1.0,  0.0,  0.0,
					-1.0,  0.0,  0.0,
					-1.0,  0.0,  0.0,
					-1.0,  0.0,  0.0
				];
			},
			vertices(x, y, z, l, h, w) {
				return [
					// Front face
					x-l, y-h, z+w,
					x+l, y-h, z+w,
					x+l, y+h, z+w,
					x-l, y+h, z+w,
					// Back face
					x-l, y-h, z-w,
					x-l, y+h, z-w,
					x+l, y+h, z-w,
					x+l, y-h, z-w,
					// Top face
					x-l, y+h, z-w,
					x-l, y+h, z+w,
					x+l, y+h, z+w,
					x+l, y+h, z-w,
					// Bottom face
					x-l, y-h, z-w,
					x+l, y-h, z-w,
					x+l, y-h, z+w,
					x-l, y-h, z+w,
					// Right face
					x+l, y-h, z-w,
					x+l, y+h, z-w,
					x+l, y+h, z+w,
					x+l, y-h, z+w,
					// Left face
					x-l, y-h, z-w,
					x-l, y-h, z+w,
					x-l, y+h, z+w,
					x-l, y+h, z-w
				]
			},
			colors(r, g, b) {
				return [
					r,g,b,
					r,g,b,
					r,g,b,
					r,g,b,
					r,g,b,
					r,g,b,
					r,g,b,
					r,g,b,
					r,g,b,
					r,g,b,
					r,g,b,
					r,g,b,
					r,g,b,
					r,g,b,
					r,g,b,
					r,g,b,
					r,g,b,
					r,g,b,
					r,g,b,
					r,g,b,
					r,g,b,
					r,g,b,
					r,g,b,
					r,g,b
				]
			}
		}
	};
	// set pointer
	const pointer = {
		init(canvas) {
			this.x = canvas.width * 0.5;
			this.y = canvas.height * 0.5;
			this.cx = this.xb = this.ex = 0;
			this.cy = this.yb = this.ey = 0;
			this.cz = this.ez = 0;
			this.temp = 0;
			this.speed = 0.001;
			this.isDown = false;
			this.add(window, "mousemove,touchmove", e => this.move(e));
			this.add(canvas.elem, "mousedown,touchstart", e => {
				this.move(e);
				this.isDown = true;
				this.xb = this.x;
				this.yb = this.y;
				webgl.elem.style.cursor = "move";
			});
			this.add(window, "mouseup,touchend,touchcancel", e => {
				this.isDown = false;
				webgl.elem.style.cursor = "pointer";
			});
		},
		move(e) {
			let touchMode = e.targetTouches,
				pointer;
			if (touchMode) {
				e.preventDefault();
				pointer = touchMode[0];
			} else pointer = e;
			this.x = pointer.clientX;
			this.y = pointer.clientY;
		},
		add(elem, events, fn) {
			for (let i = 0, e = events.split(","); i < e.length; i++) {
				elem.addEventListener(e[i], fn, false);
			}
		},
		rotate() {
			if (this.isDown) {
				this.cx += (this.x - this.xb) / 200;
				this.cy += (this.y - this.yb) / 200;
				if (this.cx > Math.PI / 2) this.cx = Math.PI / 2;
				if (this.cx < -Math.PI / 2) this.cx = -Math.PI / 2;
				if (this.cy > Math.PI / 2) this.cy = Math.PI / 2;
				if (this.cy < -Math.PI / 2) this.cy = -Math.PI / 2;
				this.tempo = 0;
				if (
					this.ex > -0.2  &&
					this.ex < 0.2  &&
					this.ey > -0.2 &&
					this.ey < 0.2 &&
					this.speed < 0.15
				) {
					this.speed *= 1.005;
				}
				if (this.speed > 0.1) {
					this.ez += 0.01;
					this.ez = this.ez % (2 * Math.PI);
				}
			} else {
				if (this.tempo > 100) {
					this.cx *= 0.995;
					this.cy *= 0.995;
					this.ez *= 0.99;
				}
				if (this.speed > 0.004) this.speed *= 0.99;
				if (this.speed < 0.004) this.speed *= 1.02;
			}
			this.xb = this.x;
			this.yb = this.y;
			this.ex += (this.cx - this.ex) * 0.1;
			this.ey += (this.cy - this.ey) * 0.1;
			this.tempo++;
		}
	};
	const Block = class {
		constructor(x, y, z) {
			this.indices = [];
			this.vertices = [];
			this.normals = [];
			this.colors = [];
			this.matrix = webgl.mat4().translate(x, y, z).uniform("modelMatrix");
			const ax = Math.abs(x);
			const ay = Math.abs(y);
			const md = (ax < 2 && ay < 2) ? 3 : (ax < 3 && ay <3 ? 1 : 0);
			this.fractalCube(0, 0, 0, 1, md, 0);
			this.aPosition = new webgl.Attribute("aPosition").load(this.vertices, 3).loadIndices(this.indices);
			this.aNormal = new webgl.Attribute("aNormal").load(this.normals, 3);
			this.aColor = new webgl.Attribute("aColor").load(this.colors, 3);
		}
		blockType() {
			const blockTypes = [
				[
					[-0.4, 0, -0.4, 0.2, 1, 0.2],
					[-0.4, 0, 0.4, 0.2, 1, 0.2],
					[0.4, 0, -0.4, 0.2, 1, 0.2],
					[0.4, 0, 0.4, 0.2, 1, 0.2],
					[-0.4, -0.4, 0, 0.2, 0.2, 1],
					[-0.4, 0.4, 0, 0.2, 0.2, 1],
					[0.4, -0.4, 0, 0.2, 0.2, 1],
					[0.4, 0.4, 0, 0.2, 0.2, 1],
					[0, -0.4, -0.4, 1, 0.2, 0.2],
					[0, 0.4, -0.4, 1, 0.2, 0.2],
					[0, -0.4, 0.4, 1, 0.2, 0.2],
					[0, 0.4, 0.4, 1, 0.2, 0.2]
				],
				[
					[-0.475, 0, -0.475, 0.051, 1, 0.051, 0.5, 0.4, 0],
					[-0.475, 0, 0.475, 0.051, 1, 0.051, 0.5, 0.4, 0],
					[0.475, 0, -0.475, 0.051, 1, 0.051, 0.5, 0.4, 0],
					[0.475, 0, 0.475, 0.051, 1, 0.051, 0.5, 0.4, 0],
					[-0.475, -0.475, 0, 0.051, 0.051, 1, 0.5, 0.4, 0],
					[-0.475, 0.475, 0, 0.051, 0.051, 1, 0.5, 0.4, 0],
					[0.475, -0.475, 0, 0.051, 0.051, 1, 0.5, 0.4, 0],
					[0.475, 0.475, 0, 0.051, 0.051, 1, 0.5, 0.4, 0],
					[0, -0.475, -0.475, 1, 0.051, 0.051, 0.5, 0.4, 0],
					[0, 0.475, -0.475, 1, 0.051, 0.051, 0.5, 0.4, 0],
					[0, -0.475, 0.475, 1, 0.051, 0.051, 0.5, 0.4, 0],
					[0, 0.475, 0.475, 1, 0.051, 0.051, 0.5, 0.4, 0]
				],
				[[0, 0, 0, 1, 1, 1]],
				[
					[0, 0, 0, 1.01, 1.01, 1.01, 0.5, 0.4, 0],
					[0, 0, -0.25, 1.02, 0.1, 0.15, 10, 9, 8],
					[0, 0, 0, 1.02, 0.1, 0.15, 10, 9, 8],
					[0, 0, 0.25, 1.02, 0.1, 0.15, 10, 9, 8]
				],
				[[0, -0.4, 0, 1, 0.1, 1]],
				[[0, 0, 0, 0.5, 0.5, 0.5, 1.5, 1.0, 0.0]]
			];
			return blockTypes[Math.floor(Math.random() * blockTypes.length)];
		}
		concat(a1, a2) {
			for (let i = 0, l = a2.length; i < l; i++) a1.push(a2[i]);
		}
		fractalCube(cx, cy, cz, scale, md, level) {
			if (Math.random() > 0.85) return;
			if (level < md && Math.random() > 0.75) {
				const s = 0.25 * scale;
				const r = scale / (1.75 - 0.25 * Math.random());
				const l = level + 1;
				this.fractalCube(cx - s, cy - s, cz + Math.random() > 0.5 ? s : -s, r, md, l);
				this.fractalCube(cx + s, cy - s, cz + Math.random() > 0.5 ? s : -s, r, md, l);
				this.fractalCube(cx - s, cy + s, cz + Math.random() > 0.5 ? s : -s, r, md, l);
				this.fractalCube(cx + s, cy + s, cz + Math.random() > 0.5 ? s : -s, r, md, l);
			} else {
				const structure = this.blockType();
				for (const cube of structure) {
					this.concat(this.indices, webgl.cube.indices(this.vertices.length / 3));
					this.concat(this.vertices, webgl.cube.vertices(
						cx + cube[0] * scale,
						cy + cube[1] * scale,
						cz + cube[2] * scale,
						cube[3] * scale / 2,
						cube[4] * scale / 2,
						cube[5] * scale / 2
					));
					this.concat(this.normals, webgl.cube.normals());
					this.concat(this.colors, webgl.cube.colors(
						cube[6] === undefined ? 1 : cube[6],
						cube[7] === undefined ? 1 : cube[7],
						cube[8] === undefined ? 1 : cube[8]
					));
				}
			}
		}
		draw() {
			this.matrix.load();
			this.aNormal.bind();
			this.aColor.bind();
			this.aPosition.bind();
			gl.drawElements(gl.TRIANGLES, this.aPosition.numIndices, gl.UNSIGNED_SHORT, 0);
		}
	};
	const layer = z => {
		for (let x = -4; x <= 4; x++) {
			for (let y = -3; y <= 3; y++) {
				if (x !== 0 || y !== 0) {
					const b = new Block(x * 0.999, y * 0.999, z);
					if (b.aPosition.numElements > 0) cubes.push(b);
				}
			}
		}
		return z - 1;
	};
	// ---- init ----
	const gl = webgl.init();
	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	pointer.init(webgl);
	const camera = webgl.camera;
	const cubes = [];
	let z = layer(0);
	let frame = 0;
	let uTime = webgl.float().uniform("uTime");
	webgl.uResolution = webgl
		.vec2()
		.set(webgl.width, webgl.height)
		.uniform("uResolution")
		.load();
	// main loop
	const run = () => {
		requestAnimationFrame(run);
		uTime.set(++frame / 20).load();
		if (z > -12) {
			// create structure
			z = layer(z - 0.05);
		} else {
			// rotate world matrix
			pointer.rotate();
			camera.view
				.identity()
				.rotateZ(pointer.ez)
				.rotateX(pointer.ey)
				.rotateY(pointer.ex)
				.load();
		}
		// draw blocs
		for (const cube of cubes) {
			cube.matrix.translate(0, 0, pointer.speed);
			if (cube.matrix.matrix[14] > 3) cube.matrix.matrix[14] -= 13.0;
			cube.draw();
		}
	};
	requestAnimationFrame(run);
}