export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;
  uniform sampler2D u_lightbuffer;

  //necessary uniforma variables -- from forward plus
  uniform int u_x_sliced;
  uniform int u_y_sliced;
  uniform int u_z_sliced;
  uniform vec2 u_screen_dim;
  uniform mat4 u_view_matrix;
  uniform float u_near_clip;
  uniform float u_far_clip;
  uniform int u_cluster_element_height;
  uniform int u_cluster_num;
  
  varying vec2 v_uv;

  //utility functions from forward plus
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
    //gb0 is color
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec3 v_position = gb0.xyz;
    //gb1 is position
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    vec3 albedo = gb1.rgb;

    //not optimized
    //gb2 is normal
    //vec4 gb2 = texture2D(u_gbuffers[2], v_uv);
    //vec3 normal = gb2.xyz;


    //optimized  -- by using the fact that norm is distance 1, so compute the last component through the formula
    // 1 = sqrt(norm.x  ^ 2, norm.y ^ 2, norm.z ^ 2)
    float norm_x = gb0[3];
    float norm_y = gb1[3];
    float norm_z = sqrt(1.0 - norm_x * norm_x - norm_y * norm_y);
    //seems having error
    vec3 normal = normalize(vec3(norm_x, norm_y, norm_z));

    
    //convert v_position from world to camera -- using view matrix
    vec3 cam_v_position = vec3(u_view_matrix * vec4(v_position,1.0));

    //invert the z coordinate of camera
    cam_v_position.z *= -1.0;
    //calculate the x, y, z index of the cluster this fragment is in
    int x_coord_idx = int(gl_FragCoord.x * float(u_x_sliced) / u_screen_dim.x);
    int y_coord_idx = int(gl_FragCoord.y * float(u_y_sliced) / u_screen_dim.y);
    int z_coord_idx = int((cam_v_position.z -  u_near_clip) * float(u_z_sliced) / (u_far_clip - u_near_clip));
    //convert to 1d index
    int cluster_index = x_coord_idx + y_coord_idx * u_x_sliced + z_coord_idx * u_x_sliced * u_y_sliced;
    //compute the uv coordinate of this cluster wihtin the cluster buffer
    float u = float(cluster_index + 1) / float(u_cluster_num + 1);
    float v = 1.0 / float(u_cluster_element_height + 1);
    //compute the distance between each row of the element(pixel) within one cluster
    float v_dist = v;
    //compute the number light affects this cluster
    //first get the first pixel of current cluster's buffers
    int light_count = int(ExtractFloat(u_clusterbuffer,u_cluster_num, u_cluster_element_height, cluster_index, 0));
    //compute the start pixel storing the light indices
    vec4 curr_pixel = texture2D(u_clusterbuffer,vec2(u,v));
    

    vec3 fragColor = vec3(0.0);

    //start compute the light contribution
    //remember to skip the first element, as it is the number of light, not the actual index
    for (int i = 1; i < ${params.maxLights}; ++i) {
      //if the number of light larger than light count, we break 
      if(i >= light_count)
      {
        break;
      }
      //compute the mod -- no mod operation within glsl
      int pixel_idx = i / 4;
      int idx_within_pixel = i - (pixel_idx * 4);

      //use mod to extract the actual light index
      int light_index = -1;
      if(idx_within_pixel == 0)
      {
        //if mod is 0, we need to update the pixel position by adding the distance to previous v
        v += v_dist;
        curr_pixel = texture2D(u_clusterbuffer,vec2(u,v));

        light_index = int(curr_pixel[0]);
      }
      else if(idx_within_pixel == 1)
      {
        light_index = int(curr_pixel[1]);
      }
      else if(idx_within_pixel == 2)
      {
        light_index = int(curr_pixel[2]);
      }
      else if(idx_within_pixel == 3)
      {
        light_index = int(curr_pixel[3]);
      }



      //use the extracted light index to get the light -- same as foward start from now
      Light light = UnpackLight(light_index);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);

      //add specular component -- idea from https://en.wikipedia.org/wiki/Blinn%E2%80%93Phong_reflection_model
      if(lambertTerm > 0.0)
      {
        //we don't pass in camera position, but view matrix have the information
        vec3 half_dir = normalize(L + cam_v_position - v_position);
        float spec_angle = max(dot(half_dir, normal), 0.0);
        float shininess = 10.0;
        float specular_component = pow(spec_angle, shininess);
        fragColor += specular_component * lambertTerm * light.color * vec3(lightIntensity);//assume specular color is the same as light
      }
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}