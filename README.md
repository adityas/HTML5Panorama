HTML5 Panorama Viewer
=============

Recently, while working with panoramic images for my research, I decided to implement a panorama viewer purely in HTML5. Most panorama viewers online require plugins like Flash or Java, but since HTML5 has a shiny new canvas element, I thought it would be a worthwhile experiment.

The viewer assumes a cylindrical projection. Essentially, by slicing up the original image, we can independently stretch out each slice to give the image surface the appearance of a 3D cylinder. The math to re-project a rectangular panorama onto a cylinder is fairly simple (involves cosecants, more details in code). 

![alt text](http://www.cs.washington.edu/homes/aditya/files/photos/pano/lo.png "lo-fi pano")
With num_slices = 20. Individual slices are visible.


If the number of slices is fairly high, it’s hard to make out that there’s any slicing at all.

hi-fi pano
With num_slices = 600


Of course, the more slices there are, the better the panorama will look, but consequently, the poorer it will perform.
Here’s a couple of demos I threw together. Click (or touch) and drag to pan:
Pantheon
La Roche Parstire
(Source images: 1, 2)
If you’re interested, feel free to delve into the source code and reuse/hack it as you see fit. Hopefully in the near future, I’ll add support for zoom, vertical panning, spherical projections and improve the overall performance.
PS: Requires an HTML5 compatible browser (Chrome/Safari/Firefox/Opera). Works on the iPhone/iPad too.
