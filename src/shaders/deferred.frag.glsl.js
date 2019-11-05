export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;

  uniform mat4 u_view_matrix;
  uniform int u_screenWidth;
  uniform int u_screenHeight;
  uniform float u_camera_far;
  uniform float u_camera_near;
  
  varying vec2 v_uv;

  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };

  float ExtractFloat(sampler2D texture, int textureWidth, int textureHeight, int index, int component) {
    float u = float(index + 1) / float(textureWidth + 1);
    int pixel = component / 4;
    float v = float(pixel + 1) / float(textureHeight + 1);
    vec4 texel = texture2D(texture, vec2(u, v));
    int pixelComponent = component - pixel * 4;
    if (pixelComponent == 0) {
      return texel[0];
    } else if (pixelComponent == 1) {
      return texel[1];
    } else if (pixelComponent == 2) {
      return texel[2];
    } else if (pixelComponent == 3) {
      return texel[3];
    }
  }

  Light UnpackLight(int index) {
    Light light;
    float u = float(index + 1) / float(${params.numLights + 1});
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.3));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.6));
    light.position = v1.xyz;

    // LOOK: This extracts the 4th float (radius) of the (index)th light in the buffer
    // Note that this is just an example implementation to extract one float.
    // There are more efficient ways if you need adjacent values
    light.radius = ExtractFloat(u_lightbuffer, ${params.numLights}, 2, index, 3);

    light.color = v2.rgb;
    return light;
  }

  // Cubic approximation of gaussian curve so we falloff to exactly 0 at the light radius
  float cubicGaussian(float h) {
    if (h < 1.0) {
      return 0.25 * pow(2.0 - h, 3.0) - pow(1.0 - h, 3.0);
    } else if (h < 2.0) {
      return 0.25 * pow(2.0 - h, 3.0);
    } else {
      return 0.0;
    }
  }
  
  void main() {
    // TODO: extract data from g buffers and do lighting

    //Unoptimized
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    vec4 gb2 = texture2D(u_gbuffers[2], v_uv);

    vec3 position = gb0.rgb;
    vec3 normal = gb1.rgb;
    vec3 albedo = gb2.rgb;

    //Optimized
    //vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    //vec4 gb1 = texture2D(u_gbuffers[1], v_uv);

    //vec3 position = gb0.rgb;
    //vec3 normal = vec3(gb1.zw, sqrt(1.0 - gb1.z * gb1.z - gb1.w * gb1.w));
    //vec3 albedo = vec3(gb0.w, gb1.xy);

    vec4 view_position = u_view_matrix * vec4(position, 1.0);
    view_position.z = -view_position.z;

    float xStride = float(u_screenWidth) / float(${params.u_xslices});
    float yStride = float(u_screenHeight) / float(${params.u_yslices});
    float zStride = float(u_camera_far - u_camera_near) / float(${params.u_zslices});

    int index_x = int(gl_FragCoord.x / xStride);
    int index_y = int(gl_FragCoord.y / yStride);
    int index_z = int((view_position.z - u_camera_near) / zStride);

    int index_in_buffer = index_x + index_y * ${params.u_xslices} + index_z * ${params.u_xslices} * ${params.u_yslices};
    int number_of_tiles = ${params.u_xslices} * ${params.u_yslices} * ${params.u_zslices};
    float u = float(index_in_buffer + 1) / float(number_of_tiles + 1);
    int texHeight = int(ceil(float(${params.maxLightsPerCluster} + 1) / 4.0));
    int number_of_lights = int(texture2D(u_clusterbuffer, vec2(u, 0)).r);

    vec3 fragColor = vec3(0.0);

    for (int i = 0; i < ${params.numLights}; ++i) {
      if(i >= number_of_lights){
        break;
      }

      int light_index = int(ExtractFloat(u_clusterbuffer, number_of_tiles, texHeight, index_in_buffer, i + 1));

      Light light = UnpackLight(light_index);
      //Light light = UnpackLight(i);
      float lightDistance = distance(light.position, position);
      vec3 L = (light.position - position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}