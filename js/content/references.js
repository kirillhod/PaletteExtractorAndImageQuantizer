// @ts-check
/**
 * Canonical references shown in the Help drawer. This file is the single source for
 * URLs in the UI; entries marked `url: null` are print publications cited for
 * attribution, matching RESEARCH_REPORT.md §References.
 *
 * All links open only on an explicit click with rel="noopener noreferrer".
 */

/**
 * @typedef {Object} Reference
 * @property {string} id
 * @property {string} title
 * @property {string} authors
 * @property {number} year
 * @property {string} venue
 * @property {string|null} url
 */

/**
 * @typedef {Object} ReferenceGroup
 * @property {string} id
 * @property {string} title
 * @property {Reference[]} items
 */

/** @type {ReferenceGroup[]} */
export const REFERENCE_GROUPS = [
  {
    id: 'extraction',
    title: 'Palette extraction',
    items: [
      {
        id: 'heckbert-1982',
        title: 'Color Image Quantization for Frame Buffer Display',
        authors: 'Paul S. Heckbert',
        year: 1982,
        venue: 'SIGGRAPH ’82',
        url: 'https://dl.acm.org/doi/10.1145/800064.801294',
      },
      {
        id: 'gervautz-1988',
        title: 'A Simple Method for Color Quantization: Octree Quantization',
        authors: 'Michael Gervautz, Werner Purgathofer',
        year: 1988,
        venue: 'New Trends in Computer Graphics, Springer',
        url: 'https://doi.org/10.1007/978-3-642-83492-9_20',
      },
      {
        id: 'wu-1991',
        title: 'Efficient Statistical Computations for Optimal Color Quantization',
        authors: 'Xiaolin Wu',
        year: 1991,
        venue: 'Graphics Gems II, Academic Press',
        url: 'https://doi.org/10.1016/B978-0-08-050754-5.50035-9',
      },
      {
        id: 'lbg-1980',
        title: 'An Algorithm for Vector Quantizer Design',
        authors: 'Yoseph Linde, Andrés Buzo, Robert M. Gray',
        year: 1980,
        venue: 'IEEE Transactions on Communications 28(1)',
        url: 'https://doi.org/10.1109/TCOM.1980.1094577',
      },
      {
        id: 'kmeanspp-2007',
        title: 'k-means++: The Advantages of Careful Seeding',
        authors: 'David Arthur, Sergei Vassilvitskii',
        year: 2007,
        venue: 'SODA ’07',
        url: null,
      },
      {
        id: 'celebi-2023',
        title: 'Forty Years of Color Quantization: A Modern, Algorithmic Survey',
        authors: 'M. Emre Celebi',
        year: 2023,
        venue: 'Artificial Intelligence Review',
        url: 'https://link.springer.com/article/10.1007/s10462-023-10406-6',
      },
      {
        id: 'celebi-2011',
        title: 'Improving the Performance of K-Means for Color Quantization',
        authors: 'M. Emre Celebi',
        year: 2011,
        venue: 'arXiv:1101.0395',
        url: 'https://arxiv.org/abs/1101.0395',
      },
    ],
  },
  {
    id: 'dithering',
    title: 'Dithering and halftoning',
    items: [
      {
        id: 'floyd-steinberg-1976',
        title: 'An Adaptive Algorithm for Spatial Greyscale',
        authors: 'Robert W. Floyd, Louis Steinberg',
        year: 1976,
        venue: 'Proceedings of the SID 17(2), 75–77',
        url: null,
      },
      {
        id: 'bayer-1973',
        title: 'An Optimum Method for Two-Level Rendition of Continuous-Tone Pictures',
        authors: 'Bryce E. Bayer',
        year: 1973,
        venue: 'IEEE International Conference on Communications',
        url: null,
      },
      {
        id: 'ulichney-1993',
        title: 'The Void-and-Cluster Method for Dither Array Generation',
        authors: 'Robert Ulichney',
        year: 1993,
        venue: 'Proc. SPIE 1913',
        url: 'https://doi.org/10.1117/12.152707',
      },
    ],
  },
  {
    id: 'color',
    title: 'Color, metrics, and output',
    items: [
      {
        id: 'sharma-2005',
        title:
          'The CIEDE2000 Color-Difference Formula: Implementation Notes, Supplementary Test Data, and Mathematical Observations',
        authors: 'Gaurav Sharma, Wencheng Wu, Edul N. Dalal',
        year: 2005,
        venue: 'Color Research & Application 30(1), with the official test data',
        url: 'https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/',
      },
      {
        id: 'oklab-2020',
        title: 'A Perceptual Color Space for Image Processing (Oklab)',
        authors: 'Björn Ottosson',
        year: 2020,
        venue: 'Article and reference implementation notes',
        url: 'https://bottosson.github.io/posts/oklab/',
      },
      {
        id: 'png-3',
        title: 'Portable Network Graphics (PNG) Specification, Third Edition',
        authors: 'W3C',
        year: 2025,
        venue: 'W3C Recommendation',
        url: 'https://www.w3.org/TR/png-3/',
      },
      {
        id: 'srgb',
        title: 'A Standard Default Color Space for the Internet — sRGB',
        authors: 'W3C',
        year: 1996,
        venue: 'W3C specification',
        url: 'https://www.w3.org/Graphics/Color/sRGB',
      },
      {
        id: 'wcag22',
        title: 'Web Content Accessibility Guidelines (WCAG) 2.2',
        authors: 'W3C',
        year: 2023,
        venue: 'W3C Recommendation',
        url: 'https://www.w3.org/TR/WCAG22/',
      },
    ],
  },
];

/**
 * @typedef {Object} Credit
 * @property {string} id
 * @property {string} label
 * @property {string} text
 * @property {{ href:string, text:string }|null} link
 */

/** @type {Credit[]} */
export const CREDITS = [
  {
    id: 'code',
    label: 'Application code',
    text: 'Original implementation, GPL-3.0-only. No third-party source code is bundled.',
    link: { href: 'https://www.gnu.org/licenses/gpl-3.0.html', text: 'Read GPL-3.0' },
  },
  {
    id: 'font',
    label: 'Inter font',
    text: 'Self-hosted variable font under the SIL Open Font License 1.1. No CDN or runtime font request.',
    link: { href: './assets/fonts/OFL.txt', text: 'Read OFL.txt' },
  },
  {
    id: 'algorithms',
    label: 'Algorithms',
    text: 'Implementations are original and follow the published methods cited above. Papers are linked, not redistributed.',
    link: null,
  },
  {
    id: 'palettes',
    label: 'Built-in palettes',
    text: 'Factual colors of documented hardware and community palettes. Names and trademarks belong to their owners; this project is not affiliated with them.',
    link: null,
  },
  {
    id: 'blue-noise',
    label: 'Blue-noise mask',
    text: 'Generated locally by tools/gen-blue-noise.mjs with the void-and-cluster method. No third-party dither mask is redistributed.',
    link: null,
  },
  {
    id: 'design',
    label: 'Visual design',
    text: 'Original CSS, SVG, and layout inspired by Blender’s public design language. No Blender code, logo, theme file, or artwork is included.',
    link: null,
  },
  {
    id: 'research',
    label: 'Research',
    text: 'Algorithm choices and trade-offs are documented in RESEARCH_REPORT.md; external links open only on an explicit click.',
    link: null,
  },
];

/** @type {Reference[]} */
export const ALL_REFERENCES = REFERENCE_GROUPS.flatMap((group) => group.items);
