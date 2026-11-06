import instikiKnowledge from '../data/instiki-knowledge.json';
import bajraSandhi from '../data/bajra-sandhi-knowledge.json';
import instikiLocation from './instiki-location.json';

export type ArLocation = {
  id: string;
  name: string;
  category: string;
  title: string;
  descriptionId: string;
  descriptionEn: string;
  longitude: number;
  latitude: number;
  altitude: number;
  color: number;
  accent: number;
  scale: number;
};

export const LOCATIONS: ArLocation[] = [
  {
    id: 'bamboo-forest',
    name: 'Bamboo Forest',
    category: 'Hutan bambu',
    title: 'Penglipuran',
    descriptionId:
      'Penglipuran adalah salah satu desa adat dari Kabupaten Bangli, Provinsi Bali, Indonesia. Desa ini terkenal sebagai salah satu destinasi wisata di Bali karena masyarakatnya masih menjalankan dan melestarikan budaya tradisional Bali dalam kehidupan sehari-hari. Arsitektur bangunan dan pengolahan lahan masih mengikuti konsep Tri Hita Karana, filosofi masyarakat Bali mengenai keseimbangan hubungan antara Tuhan, manusia, dan lingkungannya. Mereka berhasil membangun pariwisata yang menguntungkan seluruh masyarakat tanpa menghilangkan budaya dan tradisi. Pada tahun 1995, Desa Penglipuran juga mendapatkan penghargaan Kalpataru dari pemerintah Indonesia atas usahanya melindungi hutan bambu di ekosistem lokal mereka.',
    descriptionEn:
      'Penglipuran is a traditional village in Bangli Regency, Bali Province, Indonesia. The village is known as one of Bali tourist destinations because its community continues to practice and preserve traditional Balinese culture in daily life. Its building architecture and land management still follow the concept of Tri Hita Karana, the Balinese philosophy of balance between relationships with God, people, and the environment. The community has developed tourism that benefits all residents without losing its culture and traditions. In 1995, Penglipuran Village also received the Kalpataru award from the Indonesian government for its efforts to protect the bamboo forest in its local ecosystem.',
    longitude: 115.35963132685659,
    latitude: -8.422441514640363,
    altitude: 0,
    color: 0x36a269,
    accent: 0xb9e769,
    scale: 1.3
  },
  {
    id: 'pura-penataran',
    name: 'Pura Penataran',
    category: 'Pura',
    title: 'Penduduk Penglipuran',
    descriptionId:
      'Berdasarkan catatan Kelihan Dinas, pejabat pemerintahan di bawah lurah yang khusus menangani administrasi pemerintahan, pada tahun 2002 sampai bulan Juli terdapat sebanyak 832 individu yang bermukim di Desa Adat Penglipuran. Jumlah tersebut terdiri dari 425 laki-laki dan 407 perempuan, serta terdapat 197 kepala keluarga yang terbagi menjadi 76 kepala keluarga dengan status Pangayah atau Krama Pangarep, yaitu anggota tetap dengan hak dan kewajiban penuh dalam adat, dan 121 kepala keluarga Pangayah atau Krama Roban, yaitu anggota sementara yang keberadaannya menjadi tanggung jawab salah satu Pangayah Pangarep. Data terbaru pada awal 2012 menunjukkan kenaikan jumlah individu yang tidak terlalu banyak, yaitu 980 individu yang tergabung dalam 229 keluarga, dilaporkan oleh I Wayan Kajeng, Ketua Administratif Desa Adat Penglipuran. Dalam 12 tahun, jumlah penduduk di desa ini bertambah sekitar 200 orang.',
    descriptionEn:
      'Based on records from the Kelihan Dinas, a government official under the village head who handles administrative affairs, from 2002 to July there were 832 individuals living in Penglipuran Traditional Village. This number consisted of 425 men and 407 women, with 197 households divided into 76 households with Pangayah or Krama Pangarep status, permanent members with full customary rights and obligations, and 121 Pangayah or Krama Roban households, temporary members whose presence is under the responsibility of one Pangayah Pangarep. Newer data from early 2012 showed a modest increase to 980 individuals in 229 families, reported by I Wayan Kajeng, Administrative Head of Penglipuran Traditional Village. In 12 years, the village population increased by around 200 people.',
    longitude: 115.35834288722265,
    latitude: -8.423516430781117,
    altitude: 0,
    color: 0xb85d3a,
    accent: 0xf0c06a,
    scale: 1.1
  },
  {
    id: 'pura-puseh',
    name: 'Pura Puseh',
    category: 'Pura',
    title: 'Wilayah Penglipuran',
    descriptionId:
      'Total area desa ini mencapai 112 hektar dengan ketinggian 500 sampai 600 meter di atas permukaan laut dan berlokasi sekitar 5 kilometer dari Kota Bangli atau 45 kilometer dari Kota Denpasar. Desa ini dikelilingi oleh desa adat lainnya, seperti Desa Kayang di utara, Desa Kubu di timur, Desa Gunaksa di selatan, dan Desa Cekeng. Temperatur bervariasi dari sejuk sampai dingin, sekitar 16 sampai 29 derajat Celsius, dengan curah hujan rata-rata 2000 milimeter per tahun. Permukaan tanah termasuk rendah dengan ketinggian 1 sampai 15 meter.',
    descriptionEn:
      'The village covers a total area of 112 hectares at an elevation of 500 to 600 meters above sea level, located around 5 kilometers from Bangli City or 45 kilometers from Denpasar City. It is surrounded by other traditional villages, including Kayang Village to the north, Kubu Village to the east, Gunaksa Village to the south, and Cekeng Village. Temperatures range from cool to cold, around 16 to 29 degrees Celsius, with average annual rainfall of 2000 millimeters. The land surface is relatively low, with a height of 1 to 15 meters.',
    longitude: 115.3585070331697,
    latitude: -8.423065900136937,
    altitude: 0,
    color: 0x495fb4,
    accent: 0x95d5ff,
    scale: 1.05
  },
  {
    id: 'bale-banjar-adat',
    name: 'Bale Banjar Adat',
    category: 'Balai warga',
    title: 'Wilayah Penglipuran',
    descriptionId:
      'Total area desa ini mencapai 112 hektar dengan ketinggian 500 sampai 600 meter di atas permukaan laut dan berlokasi sekitar 5 kilometer dari Kota Bangli atau 45 kilometer dari Kota Denpasar. Desa ini dikelilingi oleh desa adat lainnya, seperti Desa Kayang di utara, Desa Kubu di timur, Desa Gunaksa di selatan, dan Desa Cekeng. Temperatur bervariasi dari sejuk sampai dingin, sekitar 16 sampai 29 derajat Celsius, dengan curah hujan rata-rata 2000 milimeter per tahun. Permukaan tanah termasuk rendah dengan ketinggian 1 sampai 15 meter.',
    descriptionEn:
      'The village covers a total area of 112 hectares at an elevation of 500 to 600 meters above sea level, located around 5 kilometers from Bangli City or 45 kilometers from Denpasar City. It is surrounded by other traditional villages, including Kayang Village to the north, Kubu Village to the east, Gunaksa Village to the south, and Cekeng Village. Temperatures range from cool to cold, around 16 to 29 degrees Celsius, with average annual rainfall of 2000 millimeters. The land surface is relatively low, with a height of 1 to 15 meters.',
    longitude: 115.24228644108561,
    latitude: -8.670264597427067,
    altitude: 0,
    color: 0xd0994d,
    accent: 0x58c3b1,
    scale: 1.2
  },
  instikiLocation,
  ...instikiKnowledge.locations,
  ...bajraSandhi.locations
];
