export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  varying vec2 v_uv;


  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;
  uniform mat4 u_viewProjectionMatrix;
  uniform mat4 u_viewMatrix;
  uniform vec2 u_cameranearandfar;
  uniform vec2 u_screendim;

  //uniform mat4 u_viewInvMatrix;
 
  vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
  }

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
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    vec4 gb2 = texture2D(u_gbuffers[2], v_uv);
    //vec4 gb3 = texture2D(u_gbuffers[3], v_uv);

    vec3 albedo = gb0.xyz;
    vec3 pos = gb1.xyz;// world position
    vec3 normal = gb2.xyz;
    //vec3 vpos = (u_viewMatrix * vec4(pos, 1.0)).xyz; // in camera space

    //ust like plus!!!!!!!!!!!!!!!!!!!!
    //read the cluster texture to decrease the count of the light we need to deal with
    int x_slides = int(${params.xslices});
    int y_slides = int(${params.yslices});
    int z_slides = int(${params.zslices});

    vec4 incamerap = u_viewMatrix * vec4(pos, 1.0);
    incamerap[2] *= -1.0;//note!!!!!

    //get cluster index
    float stridewid = float(${params.can_wid}) / float(${params.xslices});
    float stridehei = float(${params.can_hei}) / float(${params.yslices});
    float stridedepth = (u_cameranearandfar[1] - u_cameranearandfar[0]) / float(${params.zslices});

    int indx = int(gl_FragCoord.x / stridewid);
    int indy = int(gl_FragCoord.y / stridehei); 
    int indz = int((incamerap[2] - u_cameranearandfar[0]) / stridedepth);

    int cluster_width =  int(x_slides * y_slides * z_slides);
    int cluster_height =  (int(${params.numLights}) + 1) / 4 + 1;
    
    int ind3d = int(indx + indy * x_slides + indz * x_slides * y_slides);
    float cluster_u = float(ind3d + 1) / float(int(${params.numcluster}) + 1);
    float cluster_v = float(0 + 1) / float(cluster_height + 1);
    int light_count = int(texture2D(u_clusterbuffer, vec2(cluster_u, cluster_v))[0]);//count ind1-3 
    
    vec3 fragColor = vec3(0.0);

    for (int i = 1; i <= int(${params.numLights}); i++) {
      if (i > light_count) {
        break;
      }
      int col = i - int(i / 4);
      int light_ind = int(ExtractFloat(u_clusterbuffer, cluster_width, cluster_height, ind3d, i));

      Light light = UnpackLight(light_ind);//get light info
      float lightDistance = distance(light.position, pos);//distance between light and vertice
      vec3 L = (light.position - pos) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;
    gl_FragColor = vec4(fragColor, 1.0);

    //gl_FragColor = vec4(v_uv, 0.0, 1.0);
  }
  `;
}