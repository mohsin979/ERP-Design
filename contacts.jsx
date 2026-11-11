/* HOF Pulse ERP — Contacts module.
   Reuses the previously-defined Contacts understanding (explicitly reauthorized by the product
   designer) plus this round's additions: Actions column (Delete only, type-to-confirm modal),
   Search + Filters (Filters is a UI stub only — no filter criteria defined), Export (the current
   view as CSV, exportViewCsv) + Table Settings buttons, and the All Views modal matching the new Figma reference
   ("Claude Feeder - Contacts module all view modal", node 144:3152). */

/* 30 sample rows — enough to actually exercise 25-per-page pagination (page 1 full, page 2
   with the remainder) rather than a single trivial page. */
const SAMPLE_CONTACTS_RAW = [
  {id:1, name:'Ali Khan', email:'ali.khan@hof-global.com', phone:'+92 300 1234567', owner:'Abdullah Saith', company:'Tashkent Cotton Mills', lastActivity:'Sep 8, 2026', leadStatus:'Qualified', created:'Aug 2, 2026', jobTitle:'Procurement Manager', lifecycle:'Lead', city:'Karachi', country:'Pakistan', source:'Trade Show', lastContacted:'Sep 2, 2026', contactType:'Opportunity', temperature:'Hot', dealCount:1, crsScore:null, auPoints:52, estValueMinAED:51000, estValueMaxAED:68000},
  {id:2, name:'Fatima Noor', email:'fatima.noor@hof-global.com', phone:'+92 321 7654321', owner:'Abeera Rahim', company:'Faisal Linen Co.', lastActivity:'Sep 7, 2026', leadStatus:'', created:'Jul 28, 2026', jobTitle:'Sourcing Lead', lifecycle:'Marketing Qualified', city:'Lahore', country:'Pakistan', source:'Referral', lastContacted:'Aug 26, 2026', contactType:'Others', temperature:'Warm', dealCount:0, crsScore:58, auPoints:null, estValueMinAED:6500, estValueMaxAED:8500},
  {id:3, name:'Ahmed Raza', email:'ahmed.raza@hof-global.com', phone:'+92 333 4455667', owner:'Aaliyah Khan', company:'Yangtze Yarn Group', lastActivity:'Sep 5, 2026', leadStatus:'Contacted', created:'Jul 15, 2026', jobTitle:'Head of Supply Chain', lifecycle:'Sales Qualified', city:'Dhaka', country:'Bangladesh', source:'Website Form', lastContacted:'Aug 14, 2026', contactType:'Marketing Qualified Lead', temperature:'Hot', dealCount:0, crsScore:85, auPoints:null, estValueMinAED:35500, estValueMaxAED:47500},
  {id:4, name:'Sara Malik', email:'sara.malik@hof-global.com', phone:'+92 345 9988776', owner:'', company:'Madhuri Dyeing Works', lastActivity:'Sep 3, 2026', leadStatus:'New', created:'Jun 30, 2026', jobTitle:'Merchandiser', lifecycle:'Opportunity', city:'Istanbul', country:'Türkiye', source:'Outbound Email', lastContacted:'Jul 30, 2026', contactType:'Lead', temperature:'Low', dealCount:0, crsScore:78, auPoints:null, estValueMinAED:24000, estValueMaxAED:32000},
  {id:5, name:'Bilal Ahmed', email:'bilal.ahmed@hof-global.com', phone:'+92 312 1122334', owner:'Anaya Malik', company:'Pernambuco Print House', lastActivity:'Aug 29, 2026', leadStatus:'', created:'Jun 12, 2026', jobTitle:'Production Manager', lifecycle:'Customer', city:'Ho Chi Minh City', country:'Vietnam', source:'LinkedIn', lastContacted:'Jul 11, 2026', contactType:'Sales Qualified Lead', temperature:'Hot', dealCount:2, crsScore:null, auPoints:57, estValueMinAED:37000, estValueMaxAED:49000},
  {id:6, name:'Zainab Hussain', email:'zainab.hussain@hof-global.com', phone:'+92 300 5566778', owner:'Aamir Shah', company:'Embroidery Vista Ltd.', lastActivity:'Aug 22, 2026', leadStatus:'Qualified', created:'May 30, 2026', jobTitle:'Quality Lead', lifecycle:'Lead', city:'Guangzhou', country:'China', source:'Partner', lastContacted:'Jun 28, 2026', contactType:'Customer', temperature:'Warm', dealCount:1, crsScore:62, auPoints:93, estValueMinAED:62000, estValueMaxAED:83000},
  {id:7, name:'Usman Tariq', email:'usman.tariq@hof-global.com', phone:'+92 302 3344556', owner:'Arwa Zafar', company:'Bandung Zip & Trim', lastActivity:'Aug 18, 2026', leadStatus:'Contacted', created:'May 20, 2026', jobTitle:'Logistics Coordinator', lifecycle:'Marketing Qualified', city:'Cairo', country:'Egypt', source:'Trade Show', lastContacted:'Jun 5, 2026', contactType:'Lead', temperature:'Low', dealCount:0, crsScore:55, auPoints:null, estValueMinAED:11500, estValueMaxAED:15500},
  {id:8, name:'Hassan Raza', email:'hassan.raza@hof-global.com', phone:'+92 301 2233445', owner:'Asim Ali', company:'Polyflex Packaging', lastActivity:'Aug 15, 2026', leadStatus:'New', created:'May 12, 2026', jobTitle:'Category Buyer', lifecycle:'Sales Qualified', city:'Tirupur', country:'India', source:'Referral', lastContacted:'May 22, 2026', contactType:'Lead', temperature:'Warm', dealCount:0, crsScore:82, auPoints:null, estValueMinAED:26000, estValueMaxAED:35000},
  {id:9, name:'Ayesha Bhat', email:'ayesha.bhat@hof-global.com', phone:'+92 333 8899001', owner:'Ayesha Bhat', company:'Osaka Wash & Finish', lastActivity:'Aug 12, 2026', leadStatus:'', created:'May 4, 2026', jobTitle:'Procurement Manager', lifecycle:'Opportunity', city:'Casablanca', country:'Morocco', source:'Website Form', lastContacted:'Sep 2, 2026', contactType:'Sales Qualified Lead', temperature:'Hot', dealCount:1, crsScore:74, auPoints:62, estValueMinAED:40000, estValueMaxAED:53500},
  {id:10, name:'Imran Sheikh', email:'imran.sheikh@hof-global.com', phone:'+92 321 4455223', owner:'Abdullah Saith', company:'Damco Freight & Logistics', lastActivity:'Aug 9, 2026', leadStatus:'Qualified', created:'Apr 28, 2026', jobTitle:'Sourcing Lead', lifecycle:'Customer', city:'Lyon', country:'France', source:'Outbound Email', lastContacted:'Aug 26, 2026', contactType:'Opportunity', temperature:'Hot', dealCount:1, crsScore:null, auPoints:52, estValueMinAED:52000, estValueMaxAED:69000},
  {id:11, name:'Mahnoor Aziz', email:'mahnoor.aziz@hof-global.com', phone:'+92 345 6677889', owner:'Abeera Rahim', company:'JUKI Spares & Service', lastActivity:'Aug 6, 2026', leadStatus:'Contacted', created:'Apr 21, 2026', jobTitle:'Head of Supply Chain', lifecycle:'Lead', city:'Karachi', country:'Pakistan', source:'LinkedIn', lastContacted:'Aug 14, 2026', contactType:'Lead', temperature:'Warm', dealCount:0, crsScore:59, auPoints:null, estValueMinAED:14000, estValueMaxAED:18500},
  {id:12, name:'Tariq Mehmood', email:'tariq.mehmood@hof-global.com', phone:'+92 300 1122998', owner:'', company:'Bursa Textile Mills', lastActivity:'Aug 3, 2026', leadStatus:'', created:'Apr 15, 2026', jobTitle:'Merchandiser', lifecycle:'Marketing Qualified', city:'Lahore', country:'Pakistan', source:'Partner', lastContacted:'Jul 30, 2026', contactType:'Others', temperature:'Low', dealCount:0, crsScore:86, auPoints:null, estValueMinAED:21000, estValueMaxAED:28000},
  {id:13, name:'Rabia Farooq', email:'rabia.farooq@hof-global.com', phone:'+92 312 9988776', owner:'Ali Noor', company:'Dhaka Dyehouse', lastActivity:'Jul 30, 2026', leadStatus:'New', created:'Apr 8, 2026', jobTitle:'Production Manager', lifecycle:'Sales Qualified', city:'Dhaka', country:'Bangladesh', source:'Trade Show', lastContacted:'Jul 11, 2026', contactType:'Marketing Qualified Lead', temperature:'Warm', dealCount:0, crsScore:78, auPoints:null, estValueMinAED:31000, estValueMaxAED:41000},
  {id:14, name:'Kamran Iqbal', email:'kamran.iqbal@hof-global.com', phone:'+92 333 5566443', owner:'Anaya Malik', company:'Karachi Mills & Print', lastActivity:'Jul 27, 2026', leadStatus:'Qualified', created:'Apr 2, 2026', jobTitle:'Quality Lead', lifecycle:'Opportunity', city:'Istanbul', country:'Türkiye', source:'Referral', lastContacted:'Jun 28, 2026', contactType:'Customer', temperature:'Hot', dealCount:1, crsScore:null, auPoints:58, estValueMinAED:78000, estValueMaxAED:104000},
  {id:15, name:'Sana Yousaf', email:'sana.yousaf@hof-global.com', phone:'+92 321 7788990', owner:'Aamir Shah', company:'Tirupur Yarn Traders', lastActivity:'Jul 24, 2026', leadStatus:'Contacted', created:'Mar 26, 2026', jobTitle:'Logistics Coordinator', lifecycle:'Customer', city:'Ho Chi Minh City', country:'Vietnam', source:'Website Form', lastContacted:'Jun 5, 2026', contactType:'Customer', temperature:'Warm', dealCount:1, crsScore:null, auPoints:93, estValueMinAED:63000, estValueMaxAED:84000},
  {id:16, name:'Waqas Ahmed', email:'waqas.ahmed@hof-global.com', phone:'+92 302 3345567', owner:'Arwa Zafar', company:'Lahore Embroidery House', lastActivity:'Jul 21, 2026', leadStatus:'', created:'Mar 19, 2026', jobTitle:'Category Buyer', lifecycle:'Lead', city:'Guangzhou', country:'China', source:'Outbound Email', lastContacted:'May 22, 2026', contactType:'Lead', temperature:'Low', dealCount:0, crsScore:55, auPoints:null, estValueMinAED:12000, estValueMaxAED:16000},
  {id:17, name:'Noor Fatima', email:'noor.fatima@hof-global.com', phone:'+92 301 8899776', owner:'Asim Ali', company:'YKK Asia Hong Kong', lastActivity:'Jul 18, 2026', leadStatus:'New', created:'Mar 12, 2026', jobTitle:'Procurement Manager', lifecycle:'Marketing Qualified', city:'Cairo', country:'Egypt', source:'LinkedIn', lastContacted:'Sep 2, 2026', contactType:'Lead', temperature:'Warm', dealCount:0, crsScore:82, auPoints:null, estValueMinAED:26500, estValueMaxAED:35500},
  {id:18, name:'Faisal Nadeem', email:'faisal.nadeem@hof-global.com', phone:'+92 333 2211334', owner:'Ayesha Bhat', company:'Saigon Pack Co.', lastActivity:'Jul 15, 2026', leadStatus:'Qualified', created:'Mar 5, 2026', jobTitle:'Sourcing Lead', lifecycle:'Sales Qualified', city:'Tirupur', country:'India', source:'Partner', lastContacted:'Aug 26, 2026', contactType:'Opportunity', temperature:'Hot', dealCount:2, crsScore:75, auPoints:63, estValueMinAED:63500, estValueMaxAED:84500},
  {id:19, name:'Hira Saleem', email:'hira.saleem@hof-global.com', phone:'+92 321 6655443', owner:'Abdullah Saith', company:'Prato Finishing Lab', lastActivity:'Jul 12, 2026', leadStatus:'', created:'Feb 26, 2026', jobTitle:'Head of Supply Chain', lifecycle:'Opportunity', city:'Casablanca', country:'Morocco', source:'Trade Show', lastContacted:'Aug 14, 2026', contactType:'Lead', temperature:'Low', dealCount:0, crsScore:null, auPoints:53, estValueMinAED:18500, estValueMaxAED:24500},
  {id:20, name:'Adeel Chaudhry', email:'adeel.chaudhry@hof-global.com', phone:'+92 345 1122334', owner:'Abeera Rahim', company:'Gulf Freight Services', lastActivity:'Jul 9, 2026', leadStatus:'Contacted', created:'Feb 19, 2026', jobTitle:'Merchandiser', lifecycle:'Customer', city:'Lyon', country:'France', source:'Referral', lastContacted:'Jul 30, 2026', contactType:'Customer', temperature:'Hot', dealCount:3, crsScore:59, auPoints:null, estValueMinAED:56000, estValueMaxAED:75000},
  {id:21, name:'Mehak Riaz', email:'mehak.riaz@hof-global.com', phone:'+92 300 9988112', owner:'Aaliyah Khan', company:'Pfaff Industrial GmbH', lastActivity:'Jul 6, 2026', leadStatus:'New', created:'Feb 12, 2026', jobTitle:'Production Manager', lifecycle:'Lead', city:'Karachi', country:'Pakistan', source:'Website Form', lastContacted:'Jul 11, 2026', contactType:'Subscriber', temperature:'Warm', dealCount:0, crsScore:86, auPoints:null, estValueMinAED:14000, estValueMaxAED:19000},
  {id:22, name:'Umar Farooq', email:'umar.farooq@hof-global.com', phone:'+92 312 4433221', owner:'Ali Noor', company:'Comilla Knit Mills', lastActivity:'Jul 3, 2026', leadStatus:'Qualified', created:'Feb 5, 2026', jobTitle:'Quality Lead', lifecycle:'Marketing Qualified', city:'Lahore', country:'Pakistan', source:'Outbound Email', lastContacted:'Jun 28, 2026', contactType:'Opportunity', temperature:'Hot', dealCount:1, crsScore:79, auPoints:null, estValueMinAED:69000, estValueMaxAED:92000},
  {id:23, name:'Sidra Kanwal', email:'sidra.kanwal@hof-global.com', phone:'+92 333 7766554', owner:'', company:'Casablanca Dye Studio', lastActivity:'Jun 30, 2026', leadStatus:'', created:'Jan 29, 2026', jobTitle:'Logistics Coordinator', lifecycle:'Sales Qualified', city:'Dhaka', country:'Bangladesh', source:'LinkedIn', lastContacted:'Jun 5, 2026', contactType:'Subscriber', temperature:'Low', dealCount:0, crsScore:null, auPoints:58, estValueMinAED:10500, estValueMaxAED:14000},
  {id:24, name:'Zeeshan Haider', email:'zeeshan.haider@hof-global.com', phone:'+92 321 5544332', owner:'Aamir Shah', company:'Cairo Yarn House', lastActivity:'Jun 27, 2026', leadStatus:'Contacted', created:'Jan 22, 2026', jobTitle:'Category Buyer', lifecycle:'Opportunity', city:'Istanbul', country:'Türkiye', source:'Partner', lastContacted:'May 22, 2026', contactType:'Lead', temperature:'Warm', dealCount:0, crsScore:null, auPoints:94, estValueMinAED:16500, estValueMaxAED:22000},
  {id:25, name:'Alishba Tahir', email:'alishba.tahir@hof-global.com', phone:'+92 302 6677889', owner:'Arwa Zafar', company:'Oaxaca Bordados', lastActivity:'Jun 24, 2026', leadStatus:'New', created:'Jan 15, 2026', jobTitle:'Procurement Manager', lifecycle:'Customer', city:'Ho Chi Minh City', country:'Vietnam', source:'Trade Show', lastContacted:'Sep 2, 2026', contactType:'Sales Qualified Lead', temperature:'Hot', dealCount:1, crsScore:56, auPoints:null, estValueMinAED:24500, estValueMaxAED:32500},
  {id:26, name:'Danish Aslam', email:'danish.aslam@hof-global.com', phone:'+92 301 3322110', owner:'Asim Ali', company:'Seoul Trim Co.', lastActivity:'Jun 21, 2026', leadStatus:'Qualified', created:'Jan 8, 2026', jobTitle:'Sourcing Lead', lifecycle:'Lead', city:'Guangzhou', country:'China', source:'Referral', lastContacted:'Aug 26, 2026', contactType:'Opportunity', temperature:'Warm', dealCount:1, crsScore:83, auPoints:null, estValueMinAED:74500, estValueMaxAED:99500},
  {id:27, name:'Iqra Shafique', email:'iqra.shafique@hof-global.com', phone:'+92 333 9911223', owner:'Ayesha Bhat', company:'Carolina Wash Works', lastActivity:'Jun 18, 2026', leadStatus:'', created:'Jan 2, 2026', jobTitle:'Head of Supply Chain', lifecycle:'Marketing Qualified', city:'Cairo', country:'Egypt', source:'Website Form', lastContacted:'Aug 14, 2026', contactType:'Lead', temperature:'Low', dealCount:0, crsScore:75, auPoints:64, estValueMinAED:23000, estValueMaxAED:30500},
  {id:28, name:'Bilal Yousafzai', email:'bilal.yousafzai@hof-global.com', phone:'+92 321 4400221', owner:'Abdullah Saith', company:'Lyon Print Atelier', lastActivity:'Jun 15, 2026', leadStatus:'Contacted', created:'Dec 26, 2025', jobTitle:'Merchandiser', lifecycle:'Sales Qualified', city:'Tirupur', country:'India', source:'Outbound Email', lastContacted:'Jul 30, 2026', contactType:'Lead', temperature:'Hot', dealCount:0, crsScore:null, auPoints:54, estValueMinAED:19000, estValueMaxAED:25000},
  {id:29, name:'Komal Siddiqui', email:'komal.siddiqui@hof-global.com', phone:'+92 345 2233998', owner:'Abeera Rahim', company:'Faisal Linen Co.', lastActivity:'Jun 12, 2026', leadStatus:'New', created:'Dec 19, 2025', jobTitle:'Production Manager', lifecycle:'Opportunity', city:'Casablanca', country:'Morocco', source:'LinkedIn', lastContacted:'Jul 11, 2026', contactType:'Lead', temperature:'Warm', dealCount:0, crsScore:60, auPoints:89, estValueMinAED:14500, estValueMaxAED:19500},
  {id:30, name:'Junaid Malik', email:'junaid.malik@hof-global.com', phone:'+92 300 7788443', owner:'Aaliyah Khan', company:'Yangtze Yarn Group', lastActivity:'Jun 9, 2026', leadStatus:'Qualified', created:'Dec 12, 2025', jobTitle:'Quality Lead', lifecycle:'Customer', city:'Lyon', country:'France', source:'Partner', lastContacted:'Jun 28, 2026', contactType:'Customer', temperature:'Hot', dealCount:2, crsScore:52, auPoints:null, estValueMinAED:110000, estValueMaxAED:146500},
  {id:31, name:'Areeba Qureshi', email:'areeba.qureshi@hof-global.com', phone:'+92 345 6898988', owner:'Aaliyah Khan', company:'Tashkent Cotton Mills', lastActivity:'Jun 7, 2026', leadStatus:'New', created:'Dec 7, 2025', jobTitle:'Procurement Manager', lifecycle:'Lead', city:'Karachi', country:'Pakistan', source:'Trade Show', lastContacted:'Sep 2, 2026', contactType:'Marketing Qualified Lead', temperature:'Warm', dealCount:0, crsScore:79, auPoints:null, estValueMinAED:31500, estValueMaxAED:42000},
  {id:32, name:'Hamza Baig', email:'hamza.baig@hof-global.com', phone:'+92 301 7133045', owner:'Aamir Shah', company:'Madhuri Dyeing Works', lastActivity:'Jun 5, 2026', leadStatus:'Contacted', created:'Dec 2, 2025', jobTitle:'Quality Lead', lifecycle:'Marketing Qualified', city:'Tirupur', country:'India', source:'Partner', lastContacted:'Jun 28, 2026', contactType:'Lead', temperature:'Low', dealCount:0, crsScore:null, auPoints:59, estValueMinAED:21000, estValueMaxAED:28000},
  {id:33, name:'Maryam Rizvi', email:'maryam.rizvi@hof-global.com', phone:'+92 300 2985069', owner:'Abdullah Saith', company:'Bandung Zip & Trim', lastActivity:'Jun 3, 2026', leadStatus:'Qualified', created:'Nov 27, 2025', jobTitle:'Head of Supply Chain', lifecycle:'Sales Qualified', city:'Ho Chi Minh City', country:'Vietnam', source:'LinkedIn', lastContacted:'Aug 14, 2026', contactType:'Marketing Qualified Lead', temperature:'Warm', dealCount:0, crsScore:null, auPoints:95, estValueMinAED:22000, estValueMaxAED:29000},
  {id:34, name:'Saad Butt', email:'saad.butt@hof-global.com', phone:'+92 321 4983636', owner:'Abeera Rahim', company:'Damco Freight & Logistics', lastActivity:'Jun 1, 2026', leadStatus:'', created:'Nov 22, 2025', jobTitle:'Category Buyer', lifecycle:'Opportunity', city:'Lahore', country:'Pakistan', source:'Outbound Email', lastContacted:'Aug 26, 2026', contactType:'Others', temperature:'Low', dealCount:0, crsScore:56, auPoints:null, estValueMinAED:5000, estValueMaxAED:7000},
  {id:35, name:'Laiba Hashmi', email:'laiba.hashmi@hof-global.com', phone:'+92 333 3157149', owner:'Ali Noor', company:'Dhaka Dyehouse', lastActivity:'May 30, 2026', leadStatus:'New', created:'Nov 17, 2025', jobTitle:'Production Manager', lifecycle:'Customer', city:'Casablanca', country:'Morocco', source:'Website Form', lastContacted:'Jun 5, 2026', contactType:'Lead', temperature:'Low', dealCount:0, crsScore:83, auPoints:null, estValueMinAED:27500, estValueMaxAED:36500},
  {id:36, name:'Owais Sheikh', email:'owais.sheikh@hof-global.com', phone:'+92 333 9464123', owner:'Anaya Malik', company:'Lahore Embroidery House', lastActivity:'May 28, 2026', leadStatus:'Contacted', created:'Nov 12, 2025', jobTitle:'Sourcing Lead', lifecycle:'Lead', city:'Guangzhou', country:'China', source:'Referral', lastContacted:'Jun 28, 2026', contactType:'Lead', temperature:'Warm', dealCount:0, crsScore:76, auPoints:null, estValueMinAED:23000, estValueMaxAED:30500},
  {id:37, name:'Hina Siddiqui', email:'hina.siddiqui@hof-global.com', phone:'+92 321 4401610', owner:'Arwa Zafar', company:'Prato Finishing Lab', lastActivity:'May 26, 2026', leadStatus:'Qualified', created:'Nov 7, 2025', jobTitle:'Procurement Manager', lifecycle:'Marketing Qualified', city:'Dhaka', country:'Bangladesh', source:'Trade Show', lastContacted:'Aug 14, 2026', contactType:'Lead', temperature:'Warm', dealCount:0, crsScore:null, auPoints:54, estValueMinAED:19000, estValueMaxAED:25000},
  {id:38, name:'Fahad Rana', email:'fahad.rana@hof-global.com', phone:'+92 302 6961674', owner:'Asim Ali', company:'Comilla Knit Mills', lastActivity:'May 24, 2026', leadStatus:'', created:'Nov 2, 2025', jobTitle:'Quality Lead', lifecycle:'Sales Qualified', city:'Lyon', country:'France', source:'Partner', lastContacted:'Aug 26, 2026', contactType:'Others', temperature:'Warm', dealCount:0, crsScore:60, auPoints:90, estValueMinAED:7000, estValueMaxAED:9500},
  {id:39, name:'Aiman Zaidi', email:'aiman.zaidi@hof-global.com', phone:'+92 300 8203405', owner:'Ayesha Bhat', company:'Oaxaca Bordados', lastActivity:'May 22, 2026', leadStatus:'New', created:'Oct 28, 2025', jobTitle:'Head of Supply Chain', lifecycle:'Opportunity', city:'Cairo', country:'Egypt', source:'LinkedIn', lastContacted:'Jun 5, 2026', contactType:'Lead', temperature:'Low', dealCount:0, crsScore:52, auPoints:null, estValueMinAED:29000, estValueMaxAED:39000},
  {id:40, name:'Talha Mirza', email:'talha.mirza@hof-global.com', phone:'+92 345 6537211', owner:'Aaliyah Khan', company:'Lyon Print Atelier', lastActivity:'May 20, 2026', leadStatus:'Contacted', created:'Oct 23, 2025', jobTitle:'Category Buyer', lifecycle:'Customer', city:'Istanbul', country:'Türkiye', source:'Outbound Email', lastContacted:'Jul 30, 2026', contactType:'Lead', temperature:'Warm', dealCount:0, crsScore:80, auPoints:null, estValueMinAED:25000, estValueMaxAED:33500},
  {id:41, name:'Rida Javed', email:'rida.javed@hof-global.com', phone:'+92 345 3867780', owner:'Aamir Shah', company:'Tashkent Cotton Mills', lastActivity:'May 18, 2026', leadStatus:'Qualified', created:'Oct 18, 2025', jobTitle:'Production Manager', lifecycle:'Lead', city:'Karachi', country:'Pakistan', source:'Website Form', lastContacted:'Aug 14, 2026', contactType:'Others', temperature:'Low', dealCount:0, crsScore:null, auPoints:60, estValueMinAED:13500, estValueMaxAED:18000},
  {id:42, name:'Shahzaib Gillani', email:'shahzaib.gillani@hof-global.com', phone:'+92 345 4755736', owner:'Abdullah Saith', company:'Madhuri Dyeing Works', lastActivity:'May 16, 2026', leadStatus:'', created:'Oct 13, 2025', jobTitle:'Sourcing Lead', lifecycle:'Marketing Qualified', city:'Tirupur', country:'India', source:'Referral', lastContacted:'May 22, 2026', contactType:'Sales Qualified Lead', temperature:'Warm', dealCount:0, crsScore:null, auPoints:95, estValueMinAED:32000, estValueMaxAED:42500},
  {id:43, name:'Anum Chaudhry', email:'anum.chaudhry@hof-global.com', phone:'+92 333 1515632', owner:'Abeera Rahim', company:'Bandung Zip & Trim', lastActivity:'May 14, 2026', leadStatus:'New', created:'Oct 8, 2025', jobTitle:'Procurement Manager', lifecycle:'Sales Qualified', city:'Ho Chi Minh City', country:'Vietnam', source:'Trade Show', lastContacted:'Jun 5, 2026', contactType:'Customer', temperature:'Hot', dealCount:1, crsScore:57, auPoints:null, estValueMinAED:51500, estValueMaxAED:68500},
  {id:44, name:'Babar Kazmi', email:'babar.kazmi@hof-global.com', phone:'+92 301 2319166', owner:'Ali Noor', company:'Damco Freight & Logistics', lastActivity:'May 12, 2026', leadStatus:'Contacted', created:'Oct 3, 2025', jobTitle:'Quality Lead', lifecycle:'Opportunity', city:'Lahore', country:'Pakistan', source:'Partner', lastContacted:'Jul 30, 2026', contactType:'Lead', temperature:'Low', dealCount:0, crsScore:84, auPoints:null, estValueMinAED:27500, estValueMaxAED:36500},
  {id:45, name:'Iqra Anwar', email:'iqra.anwar@hof-global.com', phone:'+92 345 2437272', owner:'Anaya Malik', company:'Dhaka Dyehouse', lastActivity:'May 10, 2026', leadStatus:'Qualified', created:'Sep 28, 2025', jobTitle:'Head of Supply Chain', lifecycle:'Customer', city:'Casablanca', country:'Morocco', source:'LinkedIn', lastContacted:'Aug 14, 2026', contactType:'Customer', temperature:'Hot', dealCount:1, crsScore:76, auPoints:null, estValueMinAED:89000, estValueMaxAED:118500},
  {id:46, name:'Nabeel Abbasi', email:'nabeel.abbasi@hof-global.com', phone:'+92 300 8100997', owner:'Arwa Zafar', company:'Lahore Embroidery House', lastActivity:'May 8, 2026', leadStatus:'', created:'Sep 23, 2025', jobTitle:'Category Buyer', lifecycle:'Lead', city:'Guangzhou', country:'China', source:'Outbound Email', lastContacted:'May 22, 2026', contactType:'Others', temperature:'Low', dealCount:0, crsScore:null, auPoints:55, estValueMinAED:11500, estValueMaxAED:15500},
  {id:47, name:'Sobia Lodhi', email:'sobia.lodhi@hof-global.com', phone:'+92 302 5644590', owner:'Asim Ali', company:'Prato Finishing Lab', lastActivity:'May 6, 2026', leadStatus:'New', created:'Sep 18, 2025', jobTitle:'Production Manager', lifecycle:'Marketing Qualified', city:'Dhaka', country:'Bangladesh', source:'Website Form', lastContacted:'Jul 11, 2026', contactType:'Lead', temperature:'Low', dealCount:0, crsScore:61, auPoints:91, estValueMinAED:15000, estValueMaxAED:20000},
  {id:48, name:'Yasir Bhatti', email:'yasir.bhatti@hof-global.com', phone:'+92 321 9010293', owner:'Ayesha Bhat', company:'Comilla Knit Mills', lastActivity:'May 4, 2026', leadStatus:'Contacted', created:'Sep 13, 2025', jobTitle:'Sourcing Lead', lifecycle:'Sales Qualified', city:'Lyon', country:'France', source:'Referral', lastContacted:'Jul 30, 2026', contactType:'Marketing Qualified Lead', temperature:'Warm', dealCount:0, crsScore:53, auPoints:null, estValueMinAED:37000, estValueMaxAED:49500},
  {id:49, name:'Amna Awan', email:'amna.awan@hof-global.com', phone:'+92 300 2593917', owner:'Aaliyah Khan', company:'Oaxaca Bordados', lastActivity:'May 2, 2026', leadStatus:'Qualified', created:'Sep 8, 2025', jobTitle:'Procurement Manager', lifecycle:'Opportunity', city:'Cairo', country:'Egypt', source:'Trade Show', lastContacted:'Sep 2, 2026', contactType:'Opportunity', temperature:'Hot', dealCount:2, crsScore:80, auPoints:null, estValueMinAED:71000, estValueMaxAED:95000},
  {id:50, name:'Rizwan Niazi', email:'rizwan.niazi@hof-global.com', phone:'+92 300 2778820', owner:'Aamir Shah', company:'Lyon Print Atelier', lastActivity:'Apr 30, 2026', leadStatus:'', created:'Sep 3, 2025', jobTitle:'Quality Lead', lifecycle:'Customer', city:'Istanbul', country:'Türkiye', source:'Partner', lastContacted:'May 22, 2026', contactType:'Others', temperature:'Low', dealCount:0, crsScore:null, auPoints:60, estValueMinAED:14000, estValueMaxAED:18500},
  {id:51, name:'Saima Qureshi', email:'saima.qureshi@hof-global.com', phone:'+92 321 6884071', owner:'Abdullah Saith', company:'Tashkent Cotton Mills', lastActivity:'Apr 28, 2026', leadStatus:'New', created:'Aug 29, 2025', jobTitle:'Head of Supply Chain', lifecycle:'Lead', city:'Karachi', country:'Pakistan', source:'LinkedIn', lastContacted:'Jul 11, 2026', contactType:'Customer', temperature:'Warm', dealCount:1, crsScore:null, auPoints:50, estValueMinAED:67000, estValueMaxAED:89500},
  {id:52, name:'Zubair Baig', email:'zubair.baig@hof-global.com', phone:'+92 321 8901278', owner:'Abeera Rahim', company:'Madhuri Dyeing Works', lastActivity:'Apr 26, 2026', leadStatus:'Contacted', created:'Aug 24, 2025', jobTitle:'Category Buyer', lifecycle:'Marketing Qualified', city:'Tirupur', country:'India', source:'Outbound Email', lastContacted:'Jul 30, 2026', contactType:'Marketing Qualified Lead', temperature:'Warm', dealCount:0, crsScore:57, auPoints:null, estValueMinAED:17000, estValueMaxAED:23000},
  {id:53, name:'Nida Rizvi', email:'nida.rizvi@hof-global.com', phone:'+92 302 5913671', owner:'Ali Noor', company:'Bandung Zip & Trim', lastActivity:'Apr 24, 2026', leadStatus:'Qualified', created:'Aug 19, 2025', jobTitle:'Production Manager', lifecycle:'Sales Qualified', city:'Ho Chi Minh City', country:'Vietnam', source:'Website Form', lastContacted:'Sep 2, 2026', contactType:'Lead', temperature:'Low', dealCount:0, crsScore:84, auPoints:null, estValueMinAED:28000, estValueMaxAED:37000},
  {id:54, name:'Adnan Butt', email:'adnan.butt@hof-global.com', phone:'+92 300 5470323', owner:'Anaya Malik', company:'Damco Freight & Logistics', lastActivity:'Apr 22, 2026', leadStatus:'', created:'Aug 14, 2025', jobTitle:'Sourcing Lead', lifecycle:'Opportunity', city:'Lahore', country:'Pakistan', source:'Referral', lastContacted:'Jun 28, 2026', contactType:'Lead', temperature:'Warm', dealCount:0, crsScore:77, auPoints:null, estValueMinAED:23500, estValueMaxAED:31500},
  {id:55, name:'Mehwish Hashmi', email:'mehwish.hashmi@hof-global.com', phone:'+92 333 4071066', owner:'Arwa Zafar', company:'Dhaka Dyehouse', lastActivity:'Apr 20, 2026', leadStatus:'New', created:'Aug 9, 2025', jobTitle:'Procurement Manager', lifecycle:'Customer', city:'Casablanca', country:'Morocco', source:'Trade Show', lastContacted:'Jul 11, 2026', contactType:'Opportunity', temperature:'Hot', dealCount:2, crsScore:null, auPoints:56, estValueMinAED:55500, estValueMaxAED:74000},
  {id:56, name:'Haris Sheikh', email:'haris.sheikh@hof-global.com', phone:'+92 345 7830786', owner:'Asim Ali', company:'Lahore Embroidery House', lastActivity:'Apr 18, 2026', leadStatus:'Contacted', created:'Aug 4, 2025', jobTitle:'Quality Lead', lifecycle:'Lead', city:'Guangzhou', country:'China', source:'Partner', lastContacted:'Aug 26, 2026', contactType:'Lead', temperature:'Low', dealCount:0, crsScore:61, auPoints:91, estValueMinAED:15500, estValueMaxAED:20500},
  {id:57, name:'Sadia Siddiqui', email:'sadia.siddiqui@hof-global.com', phone:'+92 321 1791810', owner:'Ayesha Bhat', company:'Prato Finishing Lab', lastActivity:'Apr 16, 2026', leadStatus:'Qualified', created:'Jul 30, 2025', jobTitle:'Head of Supply Chain', lifecycle:'Marketing Qualified', city:'Dhaka', country:'Bangladesh', source:'LinkedIn', lastContacted:'Sep 2, 2026', contactType:'Subscriber', temperature:'Low', dealCount:0, crsScore:53, auPoints:null, estValueMinAED:6000, estValueMaxAED:8000},
  {id:58, name:'Kashif Rana', email:'kashif.rana@hof-global.com', phone:'+92 301 2910481', owner:'Aaliyah Khan', company:'Comilla Knit Mills', lastActivity:'Apr 14, 2026', leadStatus:'', created:'Jul 25, 2025', jobTitle:'Category Buyer', lifecycle:'Sales Qualified', city:'Lyon', country:'France', source:'Outbound Email', lastContacted:'Jun 28, 2026', contactType:'Marketing Qualified Lead', temperature:'Warm', dealCount:0, crsScore:81, auPoints:null, estValueMinAED:32500, estValueMaxAED:43500},
  {id:59, name:'Bushra Zaidi', email:'bushra.zaidi@hof-global.com', phone:'+92 333 7621322', owner:'Aamir Shah', company:'Oaxaca Bordados', lastActivity:'Apr 12, 2026', leadStatus:'New', created:'Jul 20, 2025', jobTitle:'Production Manager', lifecycle:'Opportunity', city:'Cairo', country:'Egypt', source:'Website Form', lastContacted:'Jul 11, 2026', contactType:'Customer', temperature:'Hot', dealCount:1, crsScore:73, auPoints:61, estValueMinAED:83000, estValueMaxAED:110500},
  {id:60, name:'Moiz Mirza', email:'moiz.mirza@hof-global.com', phone:'+92 321 9168702', owner:'Abdullah Saith', company:'Lyon Print Atelier', lastActivity:'Apr 10, 2026', leadStatus:'Contacted', created:'Jul 15, 2025', jobTitle:'Sourcing Lead', lifecycle:'Customer', city:'Istanbul', country:'Türkiye', source:'Referral', lastContacted:'Aug 26, 2026', contactType:'Others', temperature:'Warm', dealCount:0, crsScore:null, auPoints:51, estValueMinAED:10000, estValueMaxAED:13500},
  {id:61, name:'Uzma Javed', email:'uzma.javed@hof-global.com', phone:'+92 321 2312509', owner:'Abeera Rahim', company:'Tashkent Cotton Mills', lastActivity:'Apr 8, 2026', leadStatus:'Qualified', created:'Jul 10, 2025', jobTitle:'Procurement Manager', lifecycle:'Lead', city:'Karachi', country:'Pakistan', source:'Trade Show', lastContacted:'Sep 2, 2026', contactType:'Opportunity', temperature:'Hot', dealCount:2, crsScore:58, auPoints:null, estValueMinAED:40000, estValueMaxAED:53000},
  {id:62, name:'Arsalan Gillani', email:'arsalan.gillani@hof-global.com', phone:'+92 345 7687303', owner:'Ali Noor', company:'Madhuri Dyeing Works', lastActivity:'Apr 6, 2026', leadStatus:'', created:'Jul 5, 2025', jobTitle:'Quality Lead', lifecycle:'Marketing Qualified', city:'Tirupur', country:'India', source:'Partner', lastContacted:'Jun 28, 2026', contactType:'Evangelist', temperature:'Hot', dealCount:3, crsScore:85, auPoints:null, estValueMinAED:107000, estValueMaxAED:143000},
  {id:63, name:'Samina Chaudhry', email:'samina.chaudhry@hof-global.com', phone:'+92 302 7721618', owner:'Anaya Malik', company:'Bandung Zip & Trim', lastActivity:'Apr 4, 2026', leadStatus:'New', created:'Jun 30, 2025', jobTitle:'Head of Supply Chain', lifecycle:'Sales Qualified', city:'Ho Chi Minh City', country:'Vietnam', source:'LinkedIn', lastContacted:'Aug 14, 2026', contactType:'Lead', temperature:'Low', dealCount:0, crsScore:77, auPoints:null, estValueMinAED:24000, estValueMaxAED:32000},
  {id:64, name:'Farhan Kazmi', email:'farhan.kazmi@hof-global.com', phone:'+92 300 9285184', owner:'Arwa Zafar', company:'Damco Freight & Logistics', lastActivity:'Apr 2, 2026', leadStatus:'Contacted', created:'Jun 25, 2025', jobTitle:'Category Buyer', lifecycle:'Opportunity', city:'Lahore', country:'Pakistan', source:'Outbound Email', lastContacted:'Aug 26, 2026', contactType:'Opportunity', temperature:'Hot', dealCount:2, crsScore:null, auPoints:56, estValueMinAED:56000, estValueMaxAED:75000},
  {id:65, name:'Tahira Anwar', email:'tahira.anwar@hof-global.com', phone:'+92 300 5437312', owner:'Asim Ali', company:'Dhaka Dyehouse', lastActivity:'Mar 31, 2026', leadStatus:'Qualified', created:'Jun 20, 2025', jobTitle:'Production Manager', lifecycle:'Customer', city:'Casablanca', country:'Morocco', source:'Website Form', lastContacted:'Jun 5, 2026', contactType:'Lead', temperature:'Low', dealCount:0, crsScore:62, auPoints:92, estValueMinAED:16000, estValueMaxAED:21000},
  {id:66, name:'Omer Abbasi', email:'omer.abbasi@hof-global.com', phone:'+92 345 1640929', owner:'Ayesha Bhat', company:'Lahore Embroidery House', lastActivity:'Mar 29, 2026', leadStatus:'', created:'Jun 15, 2025', jobTitle:'Sourcing Lead', lifecycle:'Lead', city:'Guangzhou', country:'China', source:'Referral', lastContacted:'Jun 28, 2026', contactType:'Opportunity', temperature:'Warm', dealCount:2, crsScore:54, auPoints:null, estValueMinAED:34500, estValueMaxAED:46000},
  {id:67, name:'Rabia Lodhi', email:'rabia.lodhi@hof-global.com', phone:'+92 301 3511404', owner:'Aaliyah Khan', company:'Prato Finishing Lab', lastActivity:'Mar 27, 2026', leadStatus:'New', created:'Jun 10, 2025', jobTitle:'Procurement Manager', lifecycle:'Marketing Qualified', city:'Dhaka', country:'Bangladesh', source:'Trade Show', lastContacted:'Aug 14, 2026', contactType:'Lead', temperature:'Low', dealCount:0, crsScore:81, auPoints:null, estValueMinAED:26000, estValueMaxAED:35000},
  {id:68, name:'Sohail Bhatti', email:'sohail.bhatti@hof-global.com', phone:'+92 302 9045075', owner:'Aamir Shah', company:'Comilla Knit Mills', lastActivity:'Mar 25, 2026', leadStatus:'Contacted', created:'Jun 5, 2025', jobTitle:'Quality Lead', lifecycle:'Sales Qualified', city:'Lyon', country:'France', source:'Partner', lastContacted:'Aug 26, 2026', contactType:'Marketing Qualified Lead', temperature:'Low', dealCount:0, crsScore:74, auPoints:62, estValueMinAED:28000, estValueMaxAED:37000},
  {id:69, name:'Ayesha Awan', email:'ayesha.awan@hof-global.com', phone:'+92 345 2728098', owner:'Abdullah Saith', company:'Oaxaca Bordados', lastActivity:'Mar 23, 2026', leadStatus:'Qualified', created:'May 31, 2025', jobTitle:'Head of Supply Chain', lifecycle:'Opportunity', city:'Cairo', country:'Egypt', source:'LinkedIn', lastContacted:'Jun 5, 2026', contactType:'Marketing Qualified Lead', temperature:'Warm', dealCount:0, crsScore:null, auPoints:51, estValueMinAED:23000, estValueMaxAED:30500},
  {id:70, name:'Jawad Niazi', email:'jawad.niazi@hof-global.com', phone:'+92 300 7946169', owner:'Abeera Rahim', company:'Lyon Print Atelier', lastActivity:'Mar 21, 2026', leadStatus:'', created:'May 26, 2025', jobTitle:'Category Buyer', lifecycle:'Customer', city:'Istanbul', country:'Türkiye', source:'Outbound Email', lastContacted:'Jul 30, 2026', contactType:'Lead', temperature:'Low', dealCount:0, crsScore:58, auPoints:null, estValueMinAED:13500, estValueMaxAED:18000},
  {id:71, name:'Sumbul Qureshi', email:'sumbul.qureshi@hof-global.com', phone:'+92 333 9423532', owner:'Ali Noor', company:'Tashkent Cotton Mills', lastActivity:'Mar 19, 2026', leadStatus:'New', created:'May 21, 2025', jobTitle:'Production Manager', lifecycle:'Lead', city:'Karachi', country:'Pakistan', source:'Website Form', lastContacted:'Aug 14, 2026', contactType:'Sales Qualified Lead', temperature:'Hot', dealCount:0, crsScore:85, auPoints:null, estValueMinAED:50000, estValueMaxAED:66500},
  {id:72, name:'Naveed Baig', email:'naveed.baig@hof-global.com', phone:'+92 345 5682817', owner:'Anaya Malik', company:'Madhuri Dyeing Works', lastActivity:'Mar 17, 2026', leadStatus:'Contacted', created:'May 16, 2025', jobTitle:'Sourcing Lead', lifecycle:'Marketing Qualified', city:'Tirupur', country:'India', source:'Referral', lastContacted:'May 22, 2026', contactType:'Lead', temperature:'Warm', dealCount:0, crsScore:78, auPoints:null, estValueMinAED:24000, estValueMaxAED:32000},
  {id:73, name:'Kiran Rizvi', email:'kiran.rizvi@hof-global.com', phone:'+92 301 8569487', owner:'Arwa Zafar', company:'Bandung Zip & Trim', lastActivity:'Mar 15, 2026', leadStatus:'Qualified', created:'May 11, 2025', jobTitle:'Procurement Manager', lifecycle:'Sales Qualified', city:'Ho Chi Minh City', country:'Vietnam', source:'Trade Show', lastContacted:'Jun 5, 2026', contactType:'Lead', temperature:'Low', dealCount:0, crsScore:null, auPoints:57, estValueMinAED:20000, estValueMaxAED:26500},
  {id:74, name:'Asad Butt', email:'asad.butt@hof-global.com', phone:'+92 300 6228220', owner:'Asim Ali', company:'Damco Freight & Logistics', lastActivity:'Mar 13, 2026', leadStatus:'', created:'May 6, 2025', jobTitle:'Quality Lead', lifecycle:'Opportunity', city:'Lahore', country:'Pakistan', source:'Partner', lastContacted:'Jul 30, 2026', contactType:'Lead', temperature:'Low', dealCount:0, crsScore:62, auPoints:93, estValueMinAED:16000, estValueMaxAED:21000},
  {id:75, name:'Fiza Hashmi', email:'fiza.hashmi@hof-global.com', phone:'+92 302 1650375', owner:'Ayesha Bhat', company:'Dhaka Dyehouse', lastActivity:'Mar 11, 2026', leadStatus:'New', created:'May 1, 2025', jobTitle:'Head of Supply Chain', lifecycle:'Customer', city:'Casablanca', country:'Morocco', source:'LinkedIn', lastContacted:'Aug 14, 2026', contactType:'Customer', temperature:'Hot', dealCount:1, crsScore:55, auPoints:null, estValueMinAED:47000, estValueMaxAED:63000},
  {id:76, name:'Shoaib Sheikh', email:'shoaib.sheikh@hof-global.com', phone:'+92 321 5781254', owner:'Aaliyah Khan', company:'Lahore Embroidery House', lastActivity:'Mar 9, 2026', leadStatus:'Contacted', created:'Apr 26, 2025', jobTitle:'Category Buyer', lifecycle:'Lead', city:'Guangzhou', country:'China', source:'Outbound Email', lastContacted:'May 22, 2026', contactType:'Subscriber', temperature:'Warm', dealCount:0, crsScore:82, auPoints:null, estValueMinAED:13000, estValueMaxAED:17500},
  {id:77, name:'Maham Siddiqui', email:'maham.siddiqui@hof-global.com', phone:'+92 333 5034049', owner:'Aamir Shah', company:'Prato Finishing Lab', lastActivity:'Mar 7, 2026', leadStatus:'Qualified', created:'Apr 21, 2025', jobTitle:'Production Manager', lifecycle:'Marketing Qualified', city:'Dhaka', country:'Bangladesh', source:'Website Form', lastContacted:'Jul 11, 2026', contactType:'Subscriber', temperature:'Warm', dealCount:0, crsScore:74, auPoints:62, estValueMinAED:11000, estValueMaxAED:15000},
  {id:78, name:'Ehsan Rana', email:'ehsan.rana@hof-global.com', phone:'+92 302 3326028', owner:'Abdullah Saith', company:'Comilla Knit Mills', lastActivity:'Mar 5, 2026', leadStatus:'', created:'Apr 16, 2025', jobTitle:'Sourcing Lead', lifecycle:'Sales Qualified', city:'Lyon', country:'France', source:'Referral', lastContacted:'Jul 30, 2026', contactType:'Others', temperature:'Warm', dealCount:0, crsScore:null, auPoints:52, estValueMinAED:10500, estValueMaxAED:14000},
  {id:79, name:'Sehrish Zaidi', email:'sehrish.zaidi@hof-global.com', phone:'+92 300 2668081', owner:'Abeera Rahim', company:'Oaxaca Bordados', lastActivity:'Mar 3, 2026', leadStatus:'New', created:'Apr 11, 2025', jobTitle:'Procurement Manager', lifecycle:'Opportunity', city:'Cairo', country:'Egypt', source:'Trade Show', lastContacted:'Sep 2, 2026', contactType:'Others', temperature:'Low', dealCount:0, crsScore:59, auPoints:null, estValueMinAED:6500, estValueMaxAED:8500},
  {id:80, name:'Waleed Mirza', email:'waleed.mirza@hof-global.com', phone:'+92 345 5271686', owner:'Ali Noor', company:'Lyon Print Atelier', lastActivity:'Mar 1, 2026', leadStatus:'Contacted', created:'Apr 6, 2025', jobTitle:'Quality Lead', lifecycle:'Customer', city:'Istanbul', country:'Türkiye', source:'Partner', lastContacted:'May 22, 2026', contactType:'Marketing Qualified Lead', temperature:'Low', dealCount:0, crsScore:86, auPoints:null, estValueMinAED:35500, estValueMaxAED:47500},
  {id:81, name:'Noreen Javed', email:'noreen.javed@hof-global.com', phone:'+92 302 2180212', owner:'Anaya Malik', company:'Tashkent Cotton Mills', lastActivity:'Feb 27, 2026', leadStatus:'Qualified', created:'Apr 1, 2025', jobTitle:'Head of Supply Chain', lifecycle:'Lead', city:'Karachi', country:'Pakistan', source:'LinkedIn', lastContacted:'Jul 11, 2026', contactType:'Lead', temperature:'Low', dealCount:0, crsScore:78, auPoints:null, estValueMinAED:24500, estValueMaxAED:32500},
  // Australia and Canada clients (each with a deal in that pipeline).
  {id:82, name:'Hamid Latif', email:'hamid.latif@hof-global.com', phone:'+92 300 4418203', owner:'Ali Noor', company:'Karachi Mills & Print', lastActivity:'Oct 9, 2026', leadStatus:'Qualified', created:'Aug 18, 2026', jobTitle:'Operations Manager', lifecycle:'Opportunity', city:'Karachi', country:'Pakistan', source:'Referral', lastContacted:'Oct 6, 2026', contactType:'Opportunity', temperature:'Hot', dealCount:1, crsScore:88, auPoints:null, estValueMinAED:38000, estValueMaxAED:51000},
  {id:83, name:'Sana Mir', email:'sana.mir@hof-global.com', phone:'+92 321 5530917', owner:'Arwa Zafar', company:'Faisal Linen Co.', lastActivity:'Oct 8, 2026', leadStatus:'Contacted', created:'Aug 21, 2026', jobTitle:'Finance Lead', lifecycle:'Sales Qualified', city:'Lahore', country:'Pakistan', source:'Website Form', lastContacted:'Oct 2, 2026', contactType:'Sales Qualified Lead', temperature:'Warm', dealCount:1, crsScore:null, auPoints:85, estValueMinAED:42000, estValueMaxAED:56000},
  {id:84, name:'Ali Raza Shah', email:'ali.raza.shah@hof-global.com', phone:'+92 333 7720146', owner:'Asim Ali', company:'Polyflex Packaging', lastActivity:'Oct 1, 2026', leadStatus:'Qualified', created:'Jul 30, 2026', jobTitle:'Plant Engineer', lifecycle:'Customer', city:'Islamabad', country:'Pakistan', source:'Trade Show', lastContacted:'Sep 28, 2026', contactType:'Customer', temperature:'Hot', dealCount:1, crsScore:79, auPoints:null, estValueMinAED:33000, estValueMaxAED:44000},
  {id:85, name:'Mariam Khalid', email:'mariam.khalid@hof-global.com', phone:'+92 345 2289054', owner:'Anaya Malik', company:'Dhaka Dyehouse', lastActivity:'Oct 7, 2026', leadStatus:'Qualified', created:'Aug 9, 2026', jobTitle:'Design Manager', lifecycle:'Opportunity', city:'Karachi', country:'Pakistan', source:'LinkedIn', lastContacted:'Oct 3, 2026', contactType:'Opportunity', temperature:'Hot', dealCount:1, crsScore:null, auPoints:90, estValueMinAED:47000, estValueMaxAED:63000},
  {id:86, name:'Usama Qadir', email:'usama.qadir@hof-global.com', phone:'+92 302 6612378', owner:'Hamza Siddiqui', company:'Comilla Knit Mills', lastActivity:'Sep 12, 2026', leadStatus:'New', created:'Jul 22, 2026', jobTitle:'Logistics Coordinator', lifecycle:'Lead', city:'Faisalabad', country:'Pakistan', source:'Outbound Email', lastContacted:'Sep 10, 2026', contactType:'Lead', temperature:'Low', dealCount:1, crsScore:83, auPoints:null, estValueMinAED:29000, estValueMaxAED:39000},
  {id:87, name:'Hafsa Imtiaz', email:'hafsa.imtiaz@hof-global.com', phone:'+92 300 8845130', owner:'Waleed bin Zaman', company:'Prato Finishing Lab', lastActivity:'Sep 15, 2026', leadStatus:'Contacted', created:'Jul 25, 2026', jobTitle:'QA Specialist', lifecycle:'Lead', city:'Multan', country:'Pakistan', source:'Referral', lastContacted:'Sep 11, 2026', contactType:'Lead', temperature:'Warm', dealCount:1, crsScore:null, auPoints:70, estValueMinAED:31000, estValueMaxAED:41500},
  {id:88, name:'Zain Ul Abideen', email:'zain.ul.abideen@hof-global.com', phone:'+92 321 3307461', owner:'Ali Noor', company:'Bursa Textile Mills', lastActivity:'Oct 10, 2026', leadStatus:'New', created:'Sep 27, 2026', jobTitle:'Software Engineer', lifecycle:'Lead', city:'Lahore', country:'Pakistan', source:'Website Form', lastContacted:'Oct 8, 2026', contactType:'Marketing Qualified Lead', temperature:'Warm', dealCount:1, crsScore:91, auPoints:null, estValueMinAED:36000, estValueMaxAED:48000},
  {id:89, name:'Areej Fatima', email:'areej.fatima@hof-global.com', phone:'+92 333 9154628', owner:'Arwa Zafar', company:'Embroidery Vista Ltd.', lastActivity:'Oct 11, 2026', leadStatus:'New', created:'Oct 2, 2026', jobTitle:'Nurse', lifecycle:'Lead', city:'Rawalpindi', country:'Pakistan', source:'LinkedIn', lastContacted:'Oct 9, 2026', contactType:'Marketing Qualified Lead', temperature:'Hot', dealCount:1, crsScore:null, auPoints:80, estValueMinAED:40000, estValueMaxAED:53000},
];

/* Contact Source — how the contact came in. Manual = created by hand in the CRM. A list so more
   sources can be added later. The sample data's older free-text sources map onto it (form
   sign-ups → Meta Form, everything else → Manual). */
const CONTACT_SOURCES = ['Meta Form', 'Website Form', 'Manual'];
// Lead Status — where the contact is as a lead (the sample contacts carry these values).
const LEAD_STATUSES = ['New', 'Contacted', 'Qualified'];
/* Industry — a mocked value per sample contact, from the company it works at. */
const CONTACT_INDUSTRIES = ['Textiles & Apparel', 'Logistics & Freight', 'Packaging', 'Manufacturing', 'Technology', 'Healthcare'];
const sampleIndustry = (c) => /freight|logistics/i.test(c.company) ? 'Logistics & Freight' : /pack|zip|trim/i.test(c.company) ? 'Packaging'
  : /spares|service/i.test(c.company) ? 'Manufacturing' : /software/i.test(c.jobTitle) ? 'Technology' : /nurse/i.test(c.jobTitle) ? 'Healthcare' : 'Textiles & Apparel';
const SAMPLE_CONTACTS = SAMPLE_CONTACTS_RAW.map(c => withoutRemovedStage({...c, industry:sampleIndustry(c), source: ['Website Form', 'LinkedIn'].includes(c.source) ? 'Meta Form' : 'Manual'}));

/* Every property a Contact column can show. `width` is fixed per column because frozen columns
   need deterministic sticky offsets — each has to know the exact combined width of the frozen
   columns before it. Contact is an ordinary property here: selectable, removable, unfreezable
   like any other. The row-selection checkbox is therefore NOT part of it — it lives in its own
   gutter so selection survives Contact being removed — and Actions is likewise structural
   rather than a property, which is why neither appears in this list's removable sense. */
const CONTACT_PROPERTIES = [
  {key:'name',          label:'Full Name',          width:220},
  {key:'email',         label:'Email',              width:250},
  {key:'phone',         label:'Phone Number',       width:170},
  {key:'country',       label:'Country',            width:150},
  {key:'city',          label:'City',               width:150},
  /* Backs the Types of Contact pipeline used by the Board. It is an ordinary single-select
     property, so it is also selectable as a column and usable as a filter — that is the point
     of a property-based pipeline: the board and the table read the same field. */
  {key:'contactType',   label:'Contact Type',       width:190},
  {key:'jobTitle',      label:'Job Title',          width:190},
  {key:'company',       label:'Company Name',       width:200},
  {key:'industry',      label:'Industry',           width:170},
  {key:'source',        label:'Lead Source',        width:160},
  {key:'leadStatus',    label:'Lead Status',        width:150},
  {key:'owner',         label:'Contact Owner',      width:170},
  {key:'ownerAssigned', label:'Owner Assignment Date', width:230},
  {key:'deals',         label:'Associated Deal',    width:200},
  {key:'customers',     label:'Associated Customer', width:200},
  {key:'created',       label:'Created Date',       width:150},
  {key:'lastActivity',  label:'Last Activity Date', width:170},
  {key:'lastContacted', label:'Last Contacted',     width:170},
  // Archived (not one of the defined Contact properties): hidden everywhere, values kept.
  {key:'lifecycle',     label:'Lifecycle Stage',    width:170},
];
const propByKey = (k) => CONTACT_PROPERTIES.find(p => p.key === k);
/* Properties a Board card can show: the contact's properties (its name is the card title) plus
   the clickable Associated Deals. */
const CARD_PROPERTIES = [...CONTACT_PROPERTIES.filter(p => !['name', 'deals', 'lifecycle'].includes(p.key)), {key:'deals', label:'Associated Deals'}];
const colWidth = (k) => (propByKey(k)?.width) || 170;

const SELECT_GUTTER = 44;    // selection checkbox column — structural, never counted as frozen
const ACTIONS_WIDTH = 120;
const MAX_FROZEN = 4;        // Contact and Actions are frozen by default and both count

/* BASE_COLUMNS stays the default selected set (kept as the name the rest of the file uses). */
const BASE_COLUMNS = CONTACT_PROPERTIES.slice(0, 8);

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

const DEFAULT_VIEW = () => ({
  columnOrder: BASE_COLUMNS.map(c=>c.key),
  frozenLeft: 1,          // leading columns pinned left — Contact by default
  frozenRight: 0,         // trailing property columns pinned right
  actionsFrozen: true,    // the Actions column pinned right; unfreezable, never removable
  rowsPerPage: 25,
  sort: {key:'name', dir:'asc'}, viewMode:'table', pipelineId:'typesOfContact',
  search:'', filters:{nodes:[]},
  cardSettings: DEFAULT_CARD_SETTINGS(),   // Board card content (Card Settings)
});

function makeView(id, name, opts={}){
  return {id, name, hidden:false, ...DEFAULT_VIEW(), ...opts};
}

/* ── Filters ────────────────────────────────────────────────────────────────
   Built to the discovery definition plus the four follow-up decisions: explicit
   groups at one nesting level, type-aware operator sets, associated objects
   deferred (the entry and drill-down exist, nothing behind them yet), and
   filters both filtering the grid and persisting into saved views.

   Shape: {op, nodes[]} where a node is either a row or a group of rows. One
   operator per level — the top level joins rows and groups, each group joins its
   own rows — which is what "(A AND B) OR (C AND D)" needs and no more. */

const FILTER_PROPS = [
  {key:'name',         label:'Name',               type:'text'},
  {key:'email',        label:'Email',              type:'text'},
  {key:'phone',        label:'Phone Number',       type:'text'},
  {key:'owner',        label:'Contact Owner',      type:'text'},
  {key:'company',      label:'Primary Company',    type:'text'},
  {key:'lastActivity', label:'Last Activity Date', type:'date'},
  {key:'contactType',  label:'Types of Contact',   type:'select'},
  {key:'created',      label:'Create Date',        type:'date'},
];

/* `values` is how many value inputs the operator needs — 0 suppresses the Value
   field entirely (Is empty / Is not empty), 2 is the date range, 'multi' is the
   Is-any-of status picker. */
const FILTER_OPERATORS = {
  text: [
    {id:'contains',    label:'Contains',         values:1},
    {id:'notContains', label:'Does not contain', values:1},
    {id:'startsWith',  label:'Starts with',      values:1},
    {id:'endsWith',    label:'Ends with',        values:1},
    {id:'isEmpty',     label:'Is empty',         values:0},
    {id:'isNotEmpty',  label:'Is not empty',     values:0},
  ],
  date: [
    {id:'is',         label:'Is',           values:1},
    {id:'isNot',      label:'Is not',       values:1},
    {id:'isBefore',   label:'Is before',    values:1},
    {id:'isAfter',    label:'Is after',     values:1},
    {id:'isBetween',  label:'Is between',   values:2},
    {id:'isEmpty',    label:'Is empty',     values:0},
    {id:'isNotEmpty', label:'Is not empty', values:0},
  ],
  select: [
    {id:'is',         label:'Is',           values:1},
    {id:'isNot',      label:'Is not',       values:1},
    {id:'isAnyOf',    label:'Is any of',    values:'multi'},
    {id:'isEmpty',    label:'Is empty',     values:0},
    {id:'isNotEmpty', label:'Is not empty', values:0},
  ],
  /* Counts and amounts (activity filters: Number of calls, Call duration) — the workflow
     conditions' operators (COUNT_OPERATORS). */
  number: [
    {id:'gt',     label:'Is more than', values:1},
    {id:'equals', label:'Equals',       values:1},
    {id:'lt',     label:'Is less than', values:1},
  ],
};

/* Options for the select-type filter properties. Types of Contact is ordered by its pipeline,
   because that pipeline is property-based — the stage order and the property's values are the
   same list. (Lead Status was removed with Lead.) */
const SELECT_VALUES = {
  contactType: CONTACT_TYPE_STAGES.map(s => s.value),
};
const selectValues = (key, values = SELECT_VALUES) => values[key] || [];

/* Record schema — the one place the grid, filters, Table Settings and View Settings learn which
   object they show. Contacts is the default (no provider), so Contacts behaves exactly as it
   always has; another object (Settings → Users & Teams, the connected-account tables) passes its
   own properties, filter properties, select values and cell / row-action rendering through
   <RecordSchema.Provider>. `boards:false` drops the Table / Board switcher; `selectable:false`
   drops the selection gutter; `canCreateProperty:false` hides Table Settings' create-property
   control (settings tables with a fixed set of properties); `fillWidth` (on for every table) widens the data columns in proportion to fill the
   available width, so they run right up to Actions, which stays fixed at the far right; when they're wider than the
   space they keep their own widths and the table scrolls. */
const CONTACTS_SCHEMA = {properties:CONTACT_PROPERTIES, filterProps:FILTER_PROPS, selectValues:SELECT_VALUES,
  noun:'contact', searchKeys:['name', 'email'], boards:true, selectable:true, fillWidth:true, canCreateProperty:true};
const RecordSchema = React.createContext(null);
const resolveRecordSchema = (sc) => {
  const byKey = (k) => sc.properties.find(p => p.key === k) || (sc.extendedObject ? extendedPropOf(k) : undefined);
  return {...CONTACTS_SCHEMA, renderCell:null, renderActions:null, ...sc, propByKey:byKey, colWidth:(k) => (byKey(k)?.width) || 170};
};
const useRecordSchema = () => resolveRecordSchema(React.useContext(RecordSchema) || CONTACTS_SCHEMA);

/* The grid's rows as the table lists them: Customer Profile / Accounting columns read onto the
   rows, then the search, then the sort (the table and Export share this). */
function gridRowsOf(rows, {columnOrder, search, sort, searchKeys, ordered}){
  const extKeys = columnOrder.filter(isExtendedKey);
  const read = extKeys.length ? rows.map(r => ({...r, ...Object.fromEntries(extKeys.map(k => [k, extendedValue(k, r)]))})) : rows;
  const q = (search || '').trim().toLowerCase();
  const searched = !q ? read : read.filter(r => searchKeys.some(k => String(r[k] || '').toLowerCase().includes(q)));
  if(!sort || ordered) return searched;
  const dir = sort.dir === 'asc' ? 1 : -1;
  // Numbers sort as numbers, dates by date (stored as "Sep 8, 2026", with or without a time); everything else as text.
  const time = (v) => v instanceof Date ? v.getTime() : typeof v === 'string' && /^([A-Z][a-z]{2} \d{1,2}, \d{4}|\d{4}-\d{2}-\d{2})/.test(v) ? Date.parse(v.replace(' · ', ' ')) : NaN;
  return searched.slice().sort((a,b)=> { const x = a[sort.key], y = b[sort.key];
    if(typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
    const tx = time(x), ty = time(y);
    if(!isNaN(tx) || !isNaN(ty)) return ((isNaN(tx) ? -Infinity : tx) - (isNaN(ty) ? -Infinity : ty)) * dir;
    return String(formatValue(x)||'').localeCompare(String(formatValue(y)||'')) * dir; });
}

/* Export: the current view downloaded as CSV — its rows (filters, search and sort applied, every
   page) and its columns in their order, each cell as the table shows it. */
function exportViewCsv({schema, rows, columnOrder, search, sort, fileName}){
  const sc = resolveRecordSchema(schema || CONTACTS_SCHEMA);
  const list = gridRowsOf(rows, {columnOrder, search, sort, searchKeys:sc.searchKeys, ordered:sc.ordered});
  const text = (key, row) => {
    const cell = sc.renderCell ? sc.renderCell(key, row) : undefined;
    if(typeof cell === 'string' || typeof cell === 'number') return String(cell);
    if(isExtendedKey(key)) return extendedValueText(key, row) || '';
    const v = formatValue(row[key]);
    return v || v === 0 ? String(v) : '';
  };
  const esc = (v) => /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const lines = [columnOrder.map(k => esc((sc.propByKey(k) || {}).label || k)), ...list.map(r => columnOrder.map(k => esc(text(k, r))))];
  const blob = new Blob(['\ufeff' + lines.map(l => l.join(',')).join('\r\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `${fileName}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const propMeta = (key, props = FILTER_PROPS) => props.find(p=>p.key===key);
// A property's filter carries its type's operators (propertyFilterMeta); other filters use their kind's.
const filterOperatorsOf = (m) => m ? (m.operators || FILTER_OPERATORS[m.type] || []) : [];
const opMeta = (propKey, opId, props = FILTER_PROPS) => {
  const m = propMeta(propKey, props);
  return m ? filterOperatorsOf(m).find(o=>o.id===opId) : null;
};

/* `joinOp` is the operator joining an item to the one directly above it — every gap carries its
   own, at both levels, so AND and OR can be mixed freely. It is ignored on the first item. */
const uid = (p) => p + Math.random().toString(36).slice(2,9);
const newFilterRow = () => ({id:uid('f'), kind:'row', joinOp:'AND', prop:null, op:null, value:'', value2:'', values:[]});
const newFilterGroup = () => ({id:uid('g'), kind:'group', joinOp:'AND', rows:[newFilterRow()]});
const EMPTY_FILTERS = () => ({nodes:[]});

/* A row only counts once it has both a property and an operator; until then it is
   ignored rather than matching nothing, so a half-built row never blanks the grid. */
const rowReady = (r) => !!(r.prop && r.op);
const nodeReady = (n) => n.kind==='group' ? n.rows.some(rowReady) : rowReady(n);

/* Stricter than `rowReady`: a row is *applied* only once it actually narrows the grid. A row
   whose operator still needs a value contributes nothing until that value is filled, so it is
   not counted — the badge then always equals the number of conditions really in force. */
const rowApplied = (r, props) => {
  if(!rowReady(r)) return false;
  const op = opMeta(r.prop, r.op, props);
  if(!op) return false;
  if(op.values === 0) return true;
  if(op.values === 'multi') return (r.values || []).length > 0;
  return !!r.value;
};
const countAppliedFilters = (filters, props) => (filters?.nodes || []).reduce(
  (n, node) => n + (node.kind === 'group' ? node.rows.filter(r => rowApplied(r, props)).length : (rowApplied(node, props) ? 1 : 0)), 0);

/* Date inputs hand back YYYY-MM-DD, which `new Date` reads as UTC midnight while the
   sample data ("Aug 2, 2026") reads as local midnight — comparing the two directly is
   off by a day in western timezones. Parse the ISO form by hand to keep both local. */
function parseFilterDate(s){
  if(!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if(iso) return new Date(+iso[1], +iso[2]-1, +iso[3]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
const dayNum = (d) => d.getFullYear()*10000 + d.getMonth()*100 + d.getDate();

function filterRowMatches(row, c, props){
  const meta = propMeta(row.prop, props);
  const op = opMeta(row.prop, row.op, props);
  if(!meta || !op) return true;
  // An associated object's property: the record matches when any associated record does.
  if(meta.assoc && meta.field){
    // Not narrowing until it has its value; a record with none associated reads as one with the property empty.
    const value = op.values === 'multi' ? (row.values || []) : row.value;
    if(op.values === 'multi' ? !value.length : op.values === 1 && (value === '' || value == null)) return true;
    const inner = [{...meta, key:meta.field, assoc:undefined, field:undefined}], list = (c._assoc || {})[meta.assoc] || [];
    return (list.length ? list : [{}]).some(r => filterRowMatches({...row, prop:meta.field}, r, inner));
  }

  // Customer / Accounting Properties: read from the record's Customer Profile or payment terms.
  if(meta.read){
    const value = op.values === 'multi' ? (row.values || []) : row.value;
    if(op.values === 'multi' ? !value.length : op.values === 1 && (value === '' || value == null)) return true;
    const got = meta.read(c), test = (v) => propertyValueMatches(meta.prop, row.op, v, value);
    return Array.isArray(got) ? (got.length ? (meta.all ? got.every(test) : got.some(test)) : row.op === 'isEmpty') : test(got);
  }
  const raw = c[row.prop];
  // A property: its type decides (propertyTypes.jsx) — the same matching workflows use.
  if(meta.ptype){
    const value = op.values === 'multi' ? (row.values || []) : row.value;
    if(op.values === 'multi' ? !value.length : op.values === 1 && (value === '' || value == null)) return true;   // no value yet → not narrowing
    return propertyValueMatches(meta.prop || meta.ptype, row.op, raw, value);
  }
  const filled = raw !== undefined && raw !== null && String(raw).trim() !== '';
  if(row.op === 'isEmpty')    return !filled;
  if(row.op === 'isNotEmpty') return filled;
  // `requiresValue`: a row without the value doesn't match at all (e.g. a Contact activity filter on a deal's activity).
  if(meta.requiresValue && !filled) return false;

  if(meta.type === 'select'){
    if(row.op === 'isAnyOf'){
      const set = row.values || [];
      return set.length ? set.includes(raw) : true;   // nothing picked yet → not narrowing
    }
    if(!row.value) return true;
    return row.op === 'is' ? raw === row.value : raw !== row.value;
  }

  if(meta.type === 'date'){
    const a = parseFilterDate(row.value);
    if(!a) return true;                                // no date chosen yet
    const d = parseFilterDate(raw);
    if(!d) return false;
    const D = dayNum(d), A = dayNum(a);
    if(row.op === 'is')       return D === A;
    if(row.op === 'isNot')    return D !== A;
    if(row.op === 'isBefore') return D < A;
    if(row.op === 'isAfter')  return D > A;
    if(row.op === 'isBetween'){
      const b = parseFilterDate(row.value2);
      if(!b) return true;
      const B = dayNum(b);
      return D >= Math.min(A,B) && D <= Math.max(A,B);
    }
    return true;
  }

  if(meta.type === 'number'){
    if(row.value === '' || row.value == null) return true;
    const a = Number(raw), b = Number(row.value);
    if(!filled || isNaN(a)) return false;
    return row.op === 'gt' ? a > b : row.op === 'lt' ? a < b : a === b;
  }

  if(!row.value) return true;
  const hay = String(raw||'').toLowerCase(), needle = String(row.value).toLowerCase();
  if(row.op === 'contains')    return hay.includes(needle);
  if(row.op === 'notContains') return !hay.includes(needle);
  if(row.op === 'startsWith')  return hay.startsWith(needle);
  if(row.op === 'endsWith')    return hay.endsWith(needle);
  return true;
}

/* Evaluates a sequence whose items each carry their own joining operator. Mixing AND and OR
   needs a precedence rule, and AND binds tighter than OR — the standard reading, so
   "A AND B OR C AND D" is (A AND B) OR (C AND D), exactly as it reads. Implemented as a
   sum of products: AND into the current term, OR starts a new one. Anything needing a
   different shape — "A AND (B OR C)" — is what filter groups are for. */
function evalJoinSequence(items, matches){
  let anyTrue = false, term = true;
  items.forEach((item, i) => {
    const v = matches(item);
    if(i === 0){ term = v; return; }
    if(item.joinOp === 'OR'){ anyTrue = anyTrue || term; term = v; }
    else { term = term && v; }
  });
  return anyTrue || term;
}

function filterNodeMatches(node, c, props){
  if(node.kind !== 'group') return filterRowMatches(node, c, props);
  const rows = node.rows.filter(rowReady);
  if(!rows.length) return true;
  return evalJoinSequence(rows, r=>filterRowMatches(r,c,props));
}

/* AND = both sides true, OR = either side true — applied per gap, at both levels. A group's
   internal operators are evaluated on their own; the operator before a group joins that
   group's result to what precedes it. */
function applyFilters(list, filters, props){
  const active = (filters?.nodes || []).filter(nodeReady);
  if(!active.length) return list;
  return list.filter(c => evalJoinSequence(active, n=>filterNodeMatches(n,c,props)));
}

/* ── Associated-object filters ── another object's filter properties, under "Filter by associated
   object" → the object (Contacts → Deals, Deals → Contacts): the same properties, operators and
   values as that object's own filters. `assoc`: the object (as listed), `assocNoun`: one record
   ("Deal · Deal Stage"), `field`: the property on the associated records. `hasLabel` adds a
   Yes / No filter on whether a record has any associated records ("Has associated deals").
   Rows to filter carry their associated records in `_assoc` (withAssocRecords). */
// `plural`: the associated type's name on its Filters pane (its key, `object`, when not given).
const assocFilterSchema = (object, noun, schema, hasLabel, plural) => {
  const own = (schema.filterProps || []).filter(p => !p.assoc && !p.section);
  const hasKey = `assoc:${object}:has`;
  return {
    filterProps:[
      ...(hasLabel ? [{key:hasKey, label:hasLabel, type:'select', ops:['is'], assoc:object, assocNoun:noun, assocPlural:plural, assocHas:true}] : []),
      ...own.map(p => ({...p, key:`assoc:${object}:${p.key}`, assoc:object, assocNoun:noun, assocPlural:plural, field:p.key})),
    ],
    selectValues:{...(hasLabel ? {[hasKey]:['Yes', 'No']} : {}), ...Object.fromEntries(own.map(p => [`assoc:${object}:${p.key}`, (schema.selectValues || {})[p.key] || []]))},
  };
};
const withAssocRecords = (row, object, records) => ({...row, _assoc:{...(row._assoc || {}), [object]:records}, [`assoc:${object}:has`]: records.length ? 'Yes' : 'No'});
// A schema with an associated object's filters added.
const withAssocFilters = (schema, assoc) => ({...schema, filterProps:[...schema.filterProps, ...assoc.filterProps], selectValues:{...schema.selectValues, ...assoc.selectValues}});
/* Customer Properties (the Customer Profile answers — the record's contact's) and Accounting
   Properties (the record's payment terms) as filters on Contacts, Deals and Customers: the same
   properties and readings as the workflows' (scopeFields) — no copies. `section`: its heading in
   Filter by; `read(row)`: its value(s) for a record (every installment's for All Installment
   Statuses, which must all match). */
// Each profile property under its form (`group`: "Canada CRS Score"), as the other pickers group them (extendedProps.jsx).
const recordScopeFilterProps = (data) => [['profile', EXT_PROFILE_LABEL], ['accounting', EXT_ACCOUNTING_LABEL]].flatMap(([scope, section]) =>
  (scopeFields(data, scope) || []).map(f => {
    const base = fieldProperty(f);
    if(!base) return null;
    const key = `${scope}:${f.key.replace(/^prop:/, '')}`;
    const form = scope === 'profile' ? (PROFILE_FORMS_LIVE || []).find(x => f.key.startsWith(`prop:form.${x.id}.`)) : null;
    const label = form && f.label.startsWith(`${form.name} · `) ? f.label.slice(form.name.length + 3) : f.label;
    const prop = {...base, key, label, options:(base.options || []).map(o => o && typeof o === 'object' ? o.value : o)};
    return {...propertyFilterMeta(prop), section, ...(form ? {group:form.name} : {}), read:(row) => f.many ? f.many({deal:row, data}) : f.get({deal:row, data}), all:!!f.all};
  }).filter(Boolean));
/* With the Customer Profile and Accounting Properties: as filters, and as columns a table can show
   (`extendedObject` — extendedProps.jsx; read-only). */
const withScopeFilters = (schema, data, object) => ({...schema, filterProps:[...schema.filterProps, ...recordScopeFilterProps(data)], ...(object ? {extendedObject:object} : {})});

/* `visible` reveals the trigger on header hover; it stays put (opacity, not display) so showing
   it never nudges the header label. It also stays shown while its menu is open, otherwise the
   control would vanish out from under the cursor. `align` picks the side the menu hangs from:
   the leftmost (sticky) column anchors left so the panel opens into the table instead of off
   the left edge, where the scrolling wrapper would clip it behind the CRM sidebar. */
/* Filter-by picker. Opens automatically when its row is created, per the spec. Three panes in
   the same menu: the property list (with the "Filter by associated object" entry above the
   caption), the associated objects, and an object's properties (Back returns a pane). */
/* A native <select> renders its option list through the browser, which positions the popup
   itself — it was floating away from the field and over unrelated rows, and no amount of CSS
   moves it. This is a custom control built on the same MenuShell every other dropdown in the
   product uses, so it hangs directly beneath its own field and matches Filter by exactly. */
function FilterSelect({value, placeholder, options, onPick}){
  const [open, setOpen] = React.useState(false);
  const current = options.find(o => o.id === value);
  return (
    <div style={{position:'relative', width:'100%'}}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:6,
        border:`1px solid ${T.borderStrong}`, background:'#fff', borderRadius:8,
        padding:'6px 10px', fontSize:13, fontFamily:'inherit', cursor:'pointer', textAlign:'left',
        color: current ? T.attioText : T.gray400,
      }}>
        <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
          {current ? current.label : placeholder}
        </span>
        <Icon name="chevDown" size={T.chevronSize} color={T.gray600}/>
      </button>
      {/* width:'100%' pins the panel to the field's own width and left edge. */}
      <MenuShell open={open} onClose={()=>setOpen(false)} width="100%">
        {options.map(o => (
          <MenuItem key={o.id} label={o.label} onClick={()=>{ onPick(o.id); setOpen(false); }}/>
        ))}
      </MenuShell>
    </div>
  );
}

/* Filter properties with `assoc` (e.g. 'Contact', 'Deal') are an associated object's: they're
   listed under "Filter by associated object" → the object, and read "Deal · Deal Stage". */
// `associated:false` (schema): no "Filter by associated object" entry (e.g. activity filters).
/* The root pane: a search field (any property, here or on an associated record), the record's own
   properties, then Customer Properties and Accounting Properties (where the table has them), then
   Filter by associated record. Long names are cut with an ellipsis; the full name shows on hover. */
function FilterByField({value, autoOpen, onPick}){
  const {filterProps, associated = true} = useRecordSchema();
  const [open, setOpen] = React.useState(!!autoOpen);
  const [pane, setPane] = React.useState('root');   // 'root' | 'assoc' | an associated object
  const [query, setQuery] = React.useState('');
  const meta = value && propMeta(value, filterProps);
  const fullLabel = (p) => p.assoc ? `${p.assocNoun || p.assoc} · ${p.label}` : p.group ? `${p.group} · ${p.label}` : p.label;
  const label = value ? (meta ? fullLabel(meta) : value) : 'Filter by';
  const own = filterProps.filter(p => !p.assoc && !p.section);
  const sections = [...new Set(filterProps.filter(p => !p.assoc && p.section).map(p => p.section))];
  const q = query.trim().toLowerCase();
  const found = q ? filterProps.filter(p => fullLabel(p).toLowerCase().includes(q)) : null;
  const item = (p, text) => <MenuItem key={p.key} label={<span title={text || p.label} style={{display:'block', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0}}>{text || p.label}</span>}
    onClick={()=>{ onPick(p.key); setOpen(false); setQuery(''); }}/>;
  const caption = (text) => <div style={{padding:'6px 10px 2px', fontSize:11.5, color:T.gray400}}>{text}</div>;
  const assocObjects = [...new Set(filterProps.filter(p => p.assoc).map(p => p.assoc))];
  const back = (to) => (
    <>
      <div onClick={()=>setPane(to)} style={{display:'flex', alignItems:'center', gap:6, padding:'7px 10px', borderRadius:6, fontSize:13, color:T.gray600, cursor:'pointer'}}>
        <Icon name="arrowLeft" size={13} color={T.gray600}/><span>Back</span>
      </div>
      <div style={{height:1, background:T.border, margin:'4px 0'}}/>
    </>
  );
  const drill = (text, to) => (
    <div key={to} onClick={()=>setPane(to)} style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
      padding:'7px 10px', borderRadius:6, fontSize:13, color:T.attioText, cursor:'pointer'}}>
      <span>{text}</span>
      <Icon name="chevDown" size={12} color={T.gray400} style={{transform:'rotate(-90deg)'}}/>
    </div>
  );
  const scroll = {maxHeight:300, overflowY:'auto'};
  return (
    <div style={{position:'relative', width:'100%'}}>
      <button onClick={()=>{ setPane('root'); setOpen(o=>!o); }} style={{
        width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:6,
        border:`1px solid ${T.borderStrong}`, background:'#fff', borderRadius:8,
        padding:'6px 10px', fontSize:13, cursor:'pointer',
        color: value ? T.attioText : T.gray400, textAlign:'left',
      }}>
        <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{label}</span>
        <Icon name="chevDown" size={T.chevronSize} color={T.gray600}/>
      </button>
      <MenuShell open={open} onClose={()=>{ setOpen(false); setQuery(''); }} width={270}>
        {pane === 'root' ? (
          <>
            <div style={{padding:'2px 2px 6px'}}>
              <input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search properties" aria-label="Search properties"
                style={{...fieldInput, height:32, fontSize:13}}/>
            </div>
            {found ? (
              <div style={scroll}>
                {found.map(p => item(p, fullLabel(p)))}
                {!found.length && <div style={{padding:'8px 10px', fontSize:12.5, color:T.gray400}}>No properties match.</div>}
              </div>
            ) : (<>
              <div style={scroll}>
                {caption('Filter by properties')}
                {own.map(p => item(p))}
              </div>
              {/* Customer Profile Properties, Accounting Properties: each a submenu. */}
              {sections.length > 0 && <div style={{height:1, background:T.border, margin:'4px 0'}}/>}
              {sections.map(sec => drill(sec, `section:${sec}`))}
              {associated && (<>
                <div style={{height:1, background:T.border, margin:'4px 0'}}/>
                <div onClick={()=>setPane('assoc')} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
                  padding:'7px 10px', borderRadius:6, fontSize:13, color:T.attioText, cursor:'pointer',
                }}>
                  <span>Filter by associated record</span>
                  <Icon name="chevDown" size={12} color={T.gray400} style={{transform:'rotate(-90deg)'}}/>
                </div>
              </>)}
            </>)}
          </>
        ) : pane.startsWith('section:') ? (
          <>
            {back('root')}
            <div style={scroll}>
              {(() => { const list = filterProps.filter(p => !p.assoc && p.section === pane.slice(8)), groups = [...new Set(list.map(p => p.group || ''))];
                return groups.map(g => <React.Fragment key={g || '-'}>
                  {caption(g || pane.slice(8))}
                  {list.filter(p => (p.group || '') === g).map(p => item(p))}
                </React.Fragment>); })()}
            </div>
          </>
        ) : pane === 'assoc' ? (
          <>
            {back('root')}
            {assocObjects.length ? assocObjects.map(o => drill((filterProps.find(p => p.assoc === o) || {}).assocPlural || o, o)) : (
              <div style={{padding:'10px', fontSize:12.5, color:T.gray400, lineHeight:1.5}}>
                No associated objects defined yet.
              </div>
            )}
          </>
        ) : (
          <>
            {back('assoc')}
            {/* Whether the record has any (e.g. Has associated deals), then the object's properties. */}
            {filterProps.filter(p => p.assoc === pane && p.assocHas).map(p => (
              <React.Fragment key={p.key}>
                <MenuItem label={p.label} onClick={()=>{ onPick(p.key); setOpen(false); }}/>
                <div style={{height:1, background:T.border, margin:'4px 0'}}/>
              </React.Fragment>
            ))}
            <div style={{padding:'4px 10px 2px', fontSize:11.5, color:T.gray400}}>{(filterProps.find(p => p.assoc === pane) || {}).assocNoun || pane} properties</div>
            <div style={scroll}>
              {filterProps.filter(p => p.assoc === pane && !p.assocHas).map(p => item(p))}
            </div>
          </>
        )}
      </MenuShell>
    </div>
  );
}

/* One filter row: Filter by → Filter type → Value. The value slot is always rendered at a
   fixed width, empty when the operator takes no value, so the modal never resizes as a row is
   built up — including for Is between, which needs two inputs and therefore sets that width. */
function FilterRow({row, autoOpen, onChange, onRemove}){
  const {filterProps, selectValues:values} = useRecordSchema();
  const meta = propMeta(row.prop, filterProps);
  const op = opMeta(row.prop, row.op, filterProps);
  const set = (patch) => onChange({...row, ...patch});

  const valueInputStyle = {
    border:`1px solid ${T.borderStrong}`, background:'#fff', borderRadius:8,
    padding:'6px 10px', fontSize:13, fontFamily:'inherit', color:T.attioText, minWidth:0,
  };

  let valueField = null;
  // A property: its type's value control (options from the property, or the schema's values).
  if(meta && meta.ptype && op){
    const opts = (meta.prop && meta.prop.options) || selectValues(row.prop, values);
    valueField = op.values === 0 ? null
      : <ConditionValueInput compact prop={meta.prop || meta.ptype} op={{...op, noValue:false}} options={opts.length ? opts : undefined}
          value={op.values === 'multi' ? (row.values || []) : row.value} onChange={(v)=>set(op.values === 'multi' ? {values:v} : {value:v})}/>;
  } else if(op && op.values === 1){
    if(meta.type === 'date'){
      valueField = <DateField value={row.value} onChange={(v)=>set({value:v})} inputStyle={valueInputStyle}/>;
    } else if(meta.type === 'number'){
      valueField = <input type="number" min="0" value={row.value} onChange={e=>set({value:e.target.value})} placeholder="0" style={{...valueInputStyle, width:'100%'}}/>;
    } else if(meta.type === 'select'){
      valueField = (
        <FilterSelect value={row.value} placeholder="Select…"
          options={selectValues(row.prop, values).map(v=>({id:v, label:v}))}
          onPick={(v)=>set({value:v})}/>
      );
    } else {
      valueField = <input value={row.value} onChange={e=>set({value:e.target.value})} placeholder="Value" style={{...valueInputStyle, width:'100%'}}/>;
    }
  } else if(op && op.values === 2){
    valueField = (
      /* Two inputs share one equal-width slot, so padding is trimmed and the separator is a
         dash rather than the word "and" — that recovers roughly 30px for the date fields. */
      <div style={{display:'flex', alignItems:'center', gap:5, width:'100%'}}>
        <DateField value={row.value} onChange={(v)=>set({value:v})} inputStyle={{...valueInputStyle, padding:'6px 6px'}} placeholder="Start" compact/>
        <span style={{fontSize:12.5, color:T.gray400, flexShrink:0}}>–</span>
        <DateField value={row.value2} onChange={(v)=>set({value2:v})} inputStyle={{...valueInputStyle, padding:'6px 6px'}} placeholder="End" compact/>
      </div>
    );
  } else if(op && op.values === 'multi'){
    valueField = (
      <div style={{display:'flex', alignItems:'center', gap:4, flexWrap:'wrap'}}>
        {selectValues(row.prop, values).map(v => {
          const on = (row.values||[]).includes(v);
          return (
            <button key={v} onClick={()=>set({values: on ? row.values.filter(x=>x!==v) : [...(row.values||[]), v]})}
              style={{
                border:`1px solid ${on ? T.attioBlue : T.borderStrong}`, borderRadius:9999,
                background: on ? T.blueLight : '#fff', color: on ? T.attioBlue : T.gray600,
                fontSize:12, padding:'4px 10px', cursor:'pointer',
              }}>{v}</button>
          );
        })}
      </div>
    );
  }

  /* The three fields share the row equally (flex:1 + minWidth:0). The value slot keeps its
     share whether or not it holds anything, so the row never reflows as it is built up. */
  return (
    <div style={{display:'flex', alignItems:'center', gap:8}}>
      <div style={{flex:1, minWidth:0}}>
        <FilterByField value={row.prop} autoOpen={autoOpen}
          onPick={(key)=>onChange({...row, prop:key, op:null, value:'', value2:'', values:[]})}/>
      </div>

      {/* Filter type only appears once a property is chosen — its options depend on the type. */}
      <div style={{flex:1, minWidth:0}}>
        {meta && (
          <FilterSelect value={row.op || ''} placeholder="Filter type"
            options={filterOperatorsOf(meta).filter(o => !meta.ops || meta.ops.includes(o.id))}   // `ops`: a property's own subset
            onPick={(id)=>set({op:id || null, value:'', value2:'', values:[]})}/>
        )}
      </div>

      <div style={{flex:1, minWidth:0}}>{valueField}</div>

      <button onClick={onRemove} title="Remove filter" style={{
        border:'none', background:'transparent', cursor:'pointer', color:T.gray400,
        padding:2, display:'flex', alignItems:'center', flexShrink:0,
      }}><Icon name="close" size={14}/></button>
    </div>
  );
}

/* AND/OR between items at one level. One operator governs the whole level, so it is editable
   at the first gap and echoed as plain text at the rest — rather than looking per-gap editable
   and then silently changing every other gap too. */
/* Every gap gets its own toggle — the operator belongs to the pair it sits between, not to the
   level, so AND and OR can be mixed down a list. Segmented: one bordered shell split in two,
   so it reads as a single control rather than a pair of buttons. */
function FilterJoin({op, onChange}){
  return (
    <div style={{display:'flex', alignItems:'center', padding:'3px 0'}}>
      <div style={{
        display:'inline-flex', border:`1px solid ${T.borderStrong}`, borderRadius:8,
        overflow:'hidden', background:'#fff',
      }}>
        {['AND','OR'].map(v => {
          const on = op === v;
          return (
            <button key={v} onClick={()=>onChange(v)} style={{
              border:'none', cursor:'pointer', padding:'4px 14px',
              fontSize:12, fontWeight:600, letterSpacing:.3, fontFamily:'inherit',
              background: on ? T.attioBlue : 'transparent',
              color: on ? '#fff' : T.gray600,
              transition:'background 120ms, color 120ms',
            }}>{v}</button>
          );
        })}
      </div>
    </div>
  );
}

/* Filter modal, anchored at the Filter button. Applies live — matching how search and sort
   already behave in this module — so there is no Apply step. */
function FilterModal({filters, setFilters, onClose}){
  const ref = React.useRef(null);
  const [autoOpenId, setAutoOpenId] = React.useState(null);

  /* Opening the modal drops you straight into a first row with its Filter by list already
     open, so the flow is: Filter → pick property → pick type → value. Only seeded when there
     are no filters yet, so reopening never disturbs existing ones. */
  React.useEffect(()=>{
    if(filters.nodes.length === 0){
      const r = newFilterRow();
      setFilters({...filters, nodes:[r]});
      setAutoOpenId(r.id);
    }
  }, []);

  /* That seeded row would otherwise linger — and mark the view dirty — if the user opened the
     modal and closed it again without choosing anything. Drop rows that were never touched. */
  const closeAndPrune = () => {
    const nodes = filters.nodes
      .map(n => n.kind==='group' ? {...n, rows:n.rows.filter(r=>r.prop)} : n)
      .filter(n => n.kind==='group' ? n.rows.length > 0 : !!n.prop);
    if(JSON.stringify(nodes) !== JSON.stringify(filters.nodes)) setFilters({...filters, nodes});
    onClose();
  };

  React.useEffect(()=>{
    // A date or time picker's panel floats outside the popover (data-hof-floating) — clicks there stay inside.
    const h = (e)=>{ if(ref.current && !ref.current.contains(e.target) && !(e.target.closest && e.target.closest('[data-hof-floating]'))) closeAndPrune(); };
    document.addEventListener('mousedown', h);
    return ()=>document.removeEventListener('mousedown', h);
  });

  /* Anchored at the Filter button, on top of everything: it floats (fixed, portalled to the
     page), so a container that clips its content — a record panel, a scrolling list — can't cut it
     off or cover it. The panel is wider than the space to the button's right, so it's nudged
     back just far enough to stay on screen. */
  const anchorRef = React.useRef(null);
  const [pos, setPos] = React.useState(null);
  const z = useFloatZ(true);   // opened now: on top of what was opened before
  // Follows the button while open (panel animations, scrolling, resizing): measured every frame,
  // updated only when it moves.
  React.useLayoutEffect(()=>{
    let frame;
    const place = () => {
      const a = anchorRef.current && anchorRef.current.parentElement;
      if(a){
        const r = a.getBoundingClientRect(), width = Math.min(720, window.innerWidth - 32);
        const next = {top:Math.round(r.bottom + 6), left:Math.round(Math.max(16, Math.min(r.left, window.innerWidth - 16 - width))), width};
        setPos(p => p && p.top === next.top && p.left === next.left && p.width === next.width ? p : next);
      }
      frame = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, []);

  const setNodes = (nodes) => setFilters({...filters, nodes});
  const patchNode = (id, next) => setNodes(filters.nodes.map(n => n.id===id ? next : n));
  const removeNode = (id) => setNodes(filters.nodes.filter(n => n.id!==id));

  const addRow = () => { const r = newFilterRow(); setNodes([...filters.nodes, r]); setAutoOpenId(r.id); };
  const addGroup = () => { const g = newFilterGroup(); setNodes([...filters.nodes, g]); setAutoOpenId(g.rows[0].id); };

  return (<>
    <span ref={anchorRef} style={{display:'none'}}/>
    {pos && ReactDOM.createPortal(
    <div ref={ref} style={{
      position:'fixed', top:pos.top, left:pos.left, width:pos.width, zIndex:z,
      background:'#fff', border:`1px solid ${T.border}`, borderRadius:10,
      boxShadow:'0 8px 24px rgba(16,24,40,.16)', padding:14, fontWeight:400,
    }}>

      {filters.nodes.map((node, i) => (
        <React.Fragment key={node.id}>
          {i > 0 && <FilterJoin op={node.joinOp || 'AND'} onChange={(v)=>patchNode(node.id, {...node, joinOp:v})}/>}
          {node.kind === 'row' ? (
            <div style={{padding:'3px 0'}}>
              <FilterRow row={node} autoOpen={autoOpenId===node.id}
                onChange={(next)=>patchNode(node.id, next)} onRemove={()=>removeNode(node.id)}/>
            </div>
          ) : (
            <div style={{
              border:`1px solid ${T.attioLine}`, borderRadius:8, padding:'8px 10px',
              margin:'3px 0', background:T.pageBg,
            }}>
              {node.rows.map((r, j) => (
                <React.Fragment key={r.id}>
                  {j > 0 && <FilterJoin op={r.joinOp || 'AND'}
                    onChange={(v)=>patchNode(node.id, {...node, rows:node.rows.map(x=>x.id===r.id?{...x, joinOp:v}:x)})}/>}
                  <div style={{padding:'3px 0'}}>
                    <FilterRow row={r} autoOpen={autoOpenId===r.id}
                      onChange={(next)=>patchNode(node.id, {...node, rows:node.rows.map(x=>x.id===r.id?next:x)})}
                      onRemove={()=>{
                        const rows = node.rows.filter(x=>x.id!==r.id);
                        rows.length ? patchNode(node.id, {...node, rows}) : removeNode(node.id);
                      }}/>
                  </div>
                </React.Fragment>
              ))}
              <button onClick={()=>{
                  const r = newFilterRow();
                  patchNode(node.id, {...node, rows:[...node.rows, r]});
                  setAutoOpenId(r.id);
                }}
                style={{border:'none', background:'transparent', color:T.attioBlue, fontSize:12.5, cursor:'pointer', padding:'4px 0 0'}}>
                + Add filter to group
              </button>
            </div>
          )}
        </React.Fragment>
      ))}

      <div style={{display:'flex', alignItems:'center', gap:8, marginTop:10, paddingTop:10, borderTop:`1px solid ${T.border}`}}>
        <button onClick={addRow} style={{display:'flex', alignItems:'center', gap:6, border:`1px solid ${T.borderStrong}`, background:'#fff', borderRadius:8, padding:'6px 12px', fontSize:13, color:T.gray800, cursor:'pointer'}}>
          <Icon name="plus" size={13} color={T.gray600}/> Add filter
        </button>
        <button onClick={addGroup} style={{display:'flex', alignItems:'center', gap:6, border:`1px solid ${T.borderStrong}`, background:'#fff', borderRadius:8, padding:'6px 12px', fontSize:13, color:T.gray800, cursor:'pointer'}}>
          <Icon name="plus" size={13} color={T.gray600}/> Add group
        </button>
      </div>
    </div>, document.body)}
  </>);
}

function ThreeDotMenu({onMoveLeft, onMoveRight, onSortAsc, onSortDesc, canMove=true, visible=true, align='right'}){
  const [open, setOpen] = React.useState(false);
  const shown = visible || open;
  return (
    <div style={{position:'relative'}}>
      <button onClick={(e)=>{e.stopPropagation(); setOpen(o=>!o);}} onMouseDown={e=>e.stopPropagation()} style={{
        border:'none', background:'transparent', cursor:'pointer', color:T.gray400, padding:2,
        display:'flex', alignItems:'center',
        opacity: shown ? 1 : 0, pointerEvents: shown ? 'auto' : 'none', transition:'opacity 120ms',
      }}>
        <Icon name="moreDots" size={15}/>
      </button>
      <MenuShell open={open} onClose={()=>setOpen(false)} anchorRight={align==='right'} width={168}>
        {canMove && <MenuItem label="Move column left" onClick={()=>{onMoveLeft(); setOpen(false);}}/>}
        {canMove && <MenuItem label="Move column right" onClick={()=>{onMoveRight(); setOpen(false);}}/>}
        <MenuItem label="Sort ascending" onClick={()=>{onSortAsc(); setOpen(false);}}/>
        <MenuItem label="Sort descending" onClick={()=>{onSortDesc(); setOpen(false);}}/>
      </MenuShell>
    </div>
  );
}

/* Row action menu — Edit is intentionally inert (its behavior hasn't been defined). Delete
   opens the type-to-confirm modal. */
// `note`: what happens to the record's associated records (they stay, unlinked).
// `noun`: the record's name on the button (Contact, Deal, Customer).
/* `paid`: the record has payments recorded — it can't be deleted, so this says so, with Close only. */
function DeleteConfirmModal({contactName, note, noun = 'Contact', paid, onCancel, onConfirm}){
  const [value, setValue] = React.useState('');
  const canDelete = value === 'Delete';
  if(paid) return (
    <div style={{position:'fixed', inset:0, background:'rgba(16,24,40,.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100}}>
      <div style={{background:'#fff', borderRadius:12, width:400, padding:24}}>
        <div style={{fontSize:16, fontWeight:600, color:T.gray800, marginBottom:8}}>Can't Delete "{contactName}"</div>
        <div style={{fontSize:13, color:T.gray600, lineHeight:1.5, marginBottom:20}}>This {noun.toLowerCase()} has payments recorded.</div>
        <div style={{display:'flex', justifyContent:'flex-end'}}>
          <button onClick={onCancel} style={{padding:'8px 14px', borderRadius:8, border:`1px solid ${T.borderStrong}`, background:'#fff', fontSize:13, cursor:'pointer'}}>Close</button>
        </div>
      </div>
    </div>
  );
  return (
    <div style={{position:'fixed', inset:0, background:'rgba(16,24,40,.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100}}>
      <div style={{background:'#fff', borderRadius:12, width:400, padding:24}}>
        <div style={{fontSize:16, fontWeight:600, color:T.gray800, marginBottom:8}}>Delete "{contactName}"?</div>
        <div style={{fontSize:13, color:T.gray600, lineHeight:1.5, marginBottom:16}}>
          {note && <>{note} </>}This can't be undone. Type <strong>Delete</strong> below to confirm.
        </div>
        <input autoFocus value={value} onChange={e=>setValue(e.target.value)} placeholder="Type Delete to confirm"
          style={{width:'100%', padding:'9px 12px', border:`1px solid ${T.borderStrong}`, borderRadius:8, fontSize:13, marginBottom:20, fontFamily:'inherit'}}/>
        <div style={{display:'flex', justifyContent:'flex-end', gap:8}}>
          <button onClick={onCancel} style={{padding:'8px 14px', borderRadius:8, border:`1px solid ${T.borderStrong}`, background:'#fff', fontSize:13, cursor:'pointer'}}>Cancel</button>
          <button onClick={onConfirm} disabled={!canDelete} style={{
            padding:'8px 14px', borderRadius:8, border:'none', fontSize:13, fontWeight:600,
            background: canDelete ? T.red : '#F3B4AE', color:'#fff', cursor: canDelete ? 'pointer' : 'default',
          }}>Delete {noun}</button>
        </div>
      </div>
    </div>
  );
}

/* `resetKey`: what the rows are chosen by (filters, view) — a change starts again at page 1. */
function ContactsDataGrid({rows, columnOrder, setColumnOrder, sort, setSort, search, actions, onOpenContact,
                           frozenLeft=0, frozenRight=0, actionsFrozen=true, rowsPerPage=25, resetKey}){
  const {propByKey, colWidth:baseColWidth, renderCell, renderActions, noun, nounPlural, searchKeys, selectable, fillWidth, onRowReorder,
         pinGutter = true, paginate = true, ordered = false, bulkActions} = useRecordSchema();
  const plural = nounPlural || `${noun}s`;
  /* `onRowReorder(fromId, toId)` (opt-in, e.g. pipeline stages): rows drag by the handle in the
     gutter, which takes the selection checkbox's place. `pinGutter:false` leaves the gutter
     unpinned and `paginate:false` lists every row with no pagination (lightweight tables, e.g. in
     a side panel). `ordered:true`: the rows' order is meaningful (pipeline stages) — no sorting and
     no column menus or column drag; the rows show in the order given. */
  const gutterOn = selectable || !!onRowReorder;
  const GUTTER = gutterOn ? SELECT_GUTTER : 0;
  // fillWidth: the scrolling box's width, so the data columns can be scaled to fill it.
  // Measured whenever the scrolling box appears (it can mount after the grid, e.g. once rows arrive).
  const scrollRef = React.useRef(null);
  const roRef = React.useRef(null);
  const [boxW, setBoxW] = React.useState(0);
  const setScrollEl = React.useCallback((el) => {
    scrollRef.current = el;
    if(roRef.current){ roRef.current.disconnect(); roRef.current = null; }
    if(el && fillWidth){ setBoxW(el.clientWidth); const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width)); ro.observe(el); roRef.current = ro; }
  }, [fillWidth]);
  React.useEffect(() => () => roRef.current && roRef.current.disconnect(), []);
  const [selected, setSelected] = React.useState(()=>new Set());
  const moveCol = (key, dir) => {
    setColumnOrder(order => {
      const i = order.indexOf(key);
      const j = i + dir;
      if (j < 0 || j >= order.length) return order;
      const next = order.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  /* Column drag-reorder — implemented with plain mouse events rather than the native HTML5
     drag-and-drop API. Native `draggable`/dragstart/dragover/drop was fragile here because
     each header cell also contains an interactive 3-dot menu button, and starting a native
     drag gesture over/near that nested interactive element could leave the browser's drag
     session in a bad state (reported as the page going blank when dragging a column right).

     This reorders LIVE while dragging, rather than only tracking a hypothetical drop target:
     on every mousemove, the dragged column's position in a working copy of the order
     (`liveOrder`) is recomputed from the cursor and the table re-renders in that order
     immediately — both the header cell and every body cell in that column move together.
     That makes "currently shown position" and "position it will drop into" the same thing by
     construction, which is what fixed the earlier bug where dropping around a column (e.g.
     Contact Owner) didn't land where it visually appeared to: a separate "this is where it'll
     go" indicator can disagree with the actual computed target if either one uses stale
     layout; showing the real, live-reordered table can't.

     The insertion index is found via the standard "midpoint" rule: walk the other columns
     left→right and insert before the first one whose horizontal midpoint is past the cursor;
     past every midpoint (including over the pinned Actions column) inserts after the last one.
     Because the reorder is applied immediately, each subsequent mousemove measures the OTHER
     columns' current (post-reorder) positions, so this stays accurate however far left or
     right the column travels — it isn't relative to where the drag started.

     The mousemove/mouseup listeners are attached synchronously inside the mousedown handler
     itself (not via a `useEffect` keyed on state), so tracking starts on the very first pixel
     of movement — a `useEffect` would only attach them after React commits the drag-start
     state update and re-renders, leaving a real (if narrow) window where an early, fast
     mouse movement is missed. Refs mirror the live drag key/order so the mousemove handler
     always reads the latest value without a stale closure; the `liveOrder` state exists only
     to re-render — `columnOrder` itself is untouched until the column is actually dropped, so
     an interrupted or cancelled gesture can never leave things half-reordered. */
  const dragKeyRef = React.useRef(null);
  const liveOrderRef = React.useRef(null);
  const [liveOrder, setLiveOrder] = React.useState(null);
  const colRefs = React.useRef({});
  // Only columns whose property still exists — a saved view can list one that was removed since;
  // header, cells and widths all skip it, so they stay aligned.
  const displayOrder = (liveOrder || columnOrder).filter(k => propByKey(k));
  const draggingKey = liveOrder ? dragKeyRef.current : null;

  const startColDrag = (key) => {
    dragKeyRef.current = key;
    liveOrderRef.current = columnOrder;
    setLiveOrder(columnOrder);
    document.body.style.cursor = 'grabbing';

    const handleMove = (e) => {
      const dragging = dragKeyRef.current;
      if (!dragging) return;
      const current = liveOrderRef.current;
      const others = current.filter(k => k !== dragging);
      let insertAt = others.length;
      for (let i = 0; i < others.length; i++) {
        const el = colRefs.current[others[i]];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (e.clientX < rect.left + rect.width / 2) { insertAt = i; break; }
      }
      const next = others.slice();
      next.splice(insertAt, 0, dragging);
      const changed = next.length !== current.length || next.some((k, i) => k !== current[i]);
      if (changed) {
        liveOrderRef.current = next;
        setLiveOrder(next);
      }
    };

    const finishDrag = () => {
      if (liveOrderRef.current) setColumnOrder(liveOrderRef.current);
      dragKeyRef.current = null;
      liveOrderRef.current = null;
      setLiveOrder(null);
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', finishDrag);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', finishDrag);
  };

  // Customer Profile / Accounting columns read onto the rows (as numbers where they are — sorting
  // and search use them), then searched and sorted (gridRowsOf, shared with Export).
  const extSig = columnOrder.filter(isExtendedKey).join('|');
  const sortedRows = React.useMemo(() => gridRowsOf(rows, {columnOrder, search, sort, searchKeys, ordered}), [rows, search, sort, extSig]);

  // Ticked rows that are gone (deleted, or filtered out of the table) aren't selected any more.
  React.useEffect(() => { setSelected(s => { if(!s.size) return s; const ids = new Set(sortedRows.map(r => r.id)); const n = new Set([...s].filter(id => ids.has(id))); return n.size === s.size ? s : n; }); }, [sortedRows]);
  // Bulk Actions (bulkActions.jsx): the table's own, for the ticked rows.
  const bulkItems = selected.size && bulkActions ? bulkActions([...selected], () => setSelected(new Set())) : null;
  const allChecked = selected.size > 0 && selected.size === sortedRows.length;
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(sortedRows.map(r=>r.id)));
  const toggleOne = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const sortIndicator = (key) => sort && sort.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '';

  const [page, setPage] = React.useState(1);
  React.useEffect(()=>{ setPage(1); }, [search, sort, rowsPerPage, resetKey]);
  // A row added or deleted keeps the page shown — unless it no longer exists.
  React.useEffect(()=>{ setPage(p => Math.min(p, Math.max(1, Math.ceil(sortedRows.length / rowsPerPage)))); }, [sortedRows.length, rowsPerPage]);
  /* A violation card chose a record (Violations panel): the page it's on is shown and its row
     pointed out, beside the panel. */
  const engineCtx = useWorkflowEngineCtx();
  const focusId = engineCtx && engineCtx.recordFocus ? engineCtx.recordFocus.id : null, focusNonce = focusId && engineCtx.recordFocus.nonce;
  const isFocusRow = (row) => focusId != null && String(row.id) === focusId;
  const focusRowRef = React.useRef(null);
  React.useEffect(() => {
    if(!focusId || !paginate) return;
    const i = sortedRows.findIndex(isFocusRow);
    if(i >= 0) setPage(Math.floor(i / rowsPerPage) + 1);
  }, [focusId, focusNonce]);
  React.useEffect(() => { if(focusId && focusRowRef.current) revealBesidePanel(focusRowRef.current); }, [focusId, focusNonce, page]);
  const focusBg = (row) => isFocusRow(row) ? {background:VIOLATION_TONE.bg} : {};
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / rowsPerPage));
  const pagedRows = paginate ? sortedRows.slice((page-1)*rowsPerPage, page*rowsPerPage) : sortedRows;
  const rowDrag = useDragReorder((from, to) => { if(onRowReorder && pagedRows[from] && pagedRows[to]) onRowReorder(pagedRows[from].id, pagedRows[to].id); });

  // Sticky-column separators: light gray at rest, a darker (still not black) gray once the
  // table is actually scrolled horizontally, so the sticky boundary reads more clearly right
  // when it matters. Tracked via scroll position on the scrolling wrapper.
  const [hScrolled, setHScrolled] = React.useState(false);
  const stickyBorderColor = hScrolled ? T.gray400 : T.borderStrong;

  // Which column header the cursor is over — drives the hover-only three-dot trigger.
  const [hoverCol, setHoverCol] = React.useState(null);

  /* With fillWidth the data columns grow in proportion (never below their own width) until they
     meet Actions; otherwise every column keeps its declared width. */
  const baseDataWidth = displayOrder.reduce((sum,k)=>sum+baseColWidth(k), 0);
  const scale = fillWidth && boxW ? Math.max(1, (boxW - GUTTER - ACTIONS_WIDTH) / baseDataWidth) : 1;
  const colWidth = (k) => baseColWidth(k) * scale;

  /* Frozen columns are the first `frozenLeft` and last `frozenRight` of the order, so each one
     can work out its own sticky offset from the widths of the frozen columns beside it. */
  const tableWidth = GUTTER + ACTIONS_WIDTH
    + displayOrder.reduce((sum,k)=>sum+colWidth(k), 0);
  const lastIdx = displayOrder.length - 1;
  const isFrozenLeft  = (i) => i < frozenLeft;
  const isFrozenRight = (i) => i > lastIdx - frozenRight;
  const leftOffsetOf  = (i) => GUTTER + displayOrder.slice(0, i).reduce((s,k)=>s+colWidth(k), 0);
  const rightOffsetOf = (i) => (actionsFrozen ? ACTIONS_WIDTH : 0)
    + displayOrder.slice(i+1).reduce((s,k)=>s+colWidth(k), 0);

  const cellFreeze = (i, isHeader) => {
    if(isFrozenLeft(i))  return {position:'sticky', left:leftOffsetOf(i),  zIndex:isHeader?5:2,
      background:T.headerBg, borderRight:`${i===frozenLeft-1?2:1}px solid ${i===frozenLeft-1?stickyBorderColor:T.attioLine}`};
    if(isFrozenRight(i)) return {position:'sticky', right:rightOffsetOf(i), zIndex:isHeader?5:2,
      background:T.headerBg, borderLeft:`${i===lastIdx-frozenRight+1?2:1}px solid ${i===lastIdx-frozenRight+1?stickyBorderColor:T.attioLine}`};
    return {};
  };

  return (
    <div style={{flex:1, display:'flex', flexDirection:'column', minHeight:0, background:'#fff'}}>
      <div ref={setScrollEl} style={{flex:1, overflow:'auto'}} onScroll={e=>setHScrolled(e.currentTarget.scrollLeft > 0)}>
      {/* `table-layout: fixed` with an explicit total width is what makes frozen columns line
          up. Under the default auto layout a declared width is only a minimum: long values
          (a 30-character email) stretch their column, so sticky offsets computed from the
          declared widths drift and open transparent slivers between adjacent frozen columns.
          Fixed layout makes the declared width the actual width, so the offsets are exact. */}
      <table style={{borderCollapse:'collapse', tableLayout:'fixed', width:tableWidth, fontSize:14}}>
        <thead>
          <tr>
            {/* Selection gutter — structural, always first and always pinned, so selection
                survives Contact being removed or unfrozen. Not a column, not counted frozen. */}
            {gutterOn && <th style={{
              position:'sticky', left: pinGutter ? 0 : undefined, top:0, zIndex:6, background: pinGutter ? T.headerBg : '#fff',
              width:SELECT_GUTTER, minWidth:SELECT_GUTTER, height:T.attioRowH,
              borderBottom:`1px solid ${T.attioLine}`, padding:'0 0 0 14px', textAlign:'left',
            }}>
              {selectable && <RowCheckbox checked={allChecked} indeterminate={selected.size>0 && !allChecked} onChange={toggleAll}/>}
            </th>}

            {displayOrder.map((key, i) => {
              const col = propByKey(key);
              if (!col) return null;
              const isDragging = draggingKey === key;
              return (
                <th key={key}
                  ref={el => { if (el) colRefs.current[key] = el; }}
                  onMouseDown={ordered ? undefined : ()=>startColDrag(key)}
                  onMouseEnter={()=>setHoverCol(key)} onMouseLeave={()=>setHoverCol(null)}
                  style={{
                    position:'sticky', top:0, zIndex: isDragging ? 7 : 4,
                    background: isDragging ? T.blueLight : '#fff',
                    width:colWidth(key), minWidth:colWidth(key), height:T.attioRowH,
                    borderBottom:`1px solid ${T.attioLine}`, borderRight:`1px solid ${T.attioLine}`,
                    padding:'0 12px', textAlign:'left',
                    cursor: ordered ? 'default' : isDragging ? 'grabbing' : 'grab', userSelect:'none',
                    outline: isDragging ? `2px solid ${T.blue}` : 'none', outlineOffset:-2,
                    boxShadow: isDragging ? '0 6px 14px rgba(16,24,40,.22)' : 'none',
                    ...cellFreeze(i, true),
                  }}>
                  <div style={{display:'flex', alignItems:'center', gap:12}}>
                    <span title={col.extended ? extendedFullLabel(col) : undefined} style={{fontWeight:500, color:T.attioMuted, whiteSpace:'nowrap'}}>{col.label}{sortIndicator(key)}</span>
                    {!ordered && <ThreeDotMenu visible={hoverCol===key} align={i===0 ? 'left' : 'right'}
                      onMoveLeft={()=>moveCol(key,-1)} onMoveRight={()=>moveCol(key,1)}
                      onSortAsc={()=>setSort({key, dir:'asc'})} onSortDesc={()=>setSort({key, dir:'desc'})}/>}
                  </div>
                </th>
              );
            })}

            <th style={{
              position: actionsFrozen ? 'sticky' : 'static', right:0, top:0,
              zIndex: actionsFrozen ? 5 : 4, background: actionsFrozen ? T.headerBg : '#fff',
              width:ACTIONS_WIDTH, minWidth:ACTIONS_WIDTH, height:T.attioRowH,
              borderBottom:`1px solid ${T.attioLine}`,
              borderLeft: actionsFrozen && frozenRight===0
                ? `2px solid ${stickyBorderColor}` : `1px solid ${T.attioLine}`,
              padding:'0 12px', textAlign:'left', transition:'border-color 120ms',
            }}>
              <span style={{fontWeight:500, color:T.attioMuted, whiteSpace:'nowrap'}}>Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {pagedRows.map((row, rowIdx) => (
            <tr key={row.id} ref={isFocusRow(row) ? focusRowRef : undefined} {...(onRowReorder ? rowDrag.props(rowIdx) : {})}
              style={onRowReorder && rowDrag.over === rowIdx ? {background:T.blueLight} : isFocusRow(row) ? {background:VIOLATION_TONE.bg, outline:`1px solid ${VIOLATION_TONE.color}`, outlineOffset:-1} : undefined}>
              {gutterOn && <td style={{
                position: pinGutter ? 'sticky' : 'static', left:0, zIndex:3, background: pinGutter ? T.headerBg : 'transparent',
                width:SELECT_GUTTER, minWidth:SELECT_GUTTER, height:T.attioRowH,
                borderBottom:`1px solid ${T.attioLine}`, padding:'0 0 0 14px', cursor: onRowReorder ? 'grab' : undefined, ...focusBg(row),
              }}>
                {onRowReorder
                  ? <span title="Drag to reorder" style={{display:'flex'}}><Icon name="dragHandle" size={16} color={T.gray400}/></span>
                  : <RowCheckbox checked={selected.has(row.id)} onChange={()=>toggleOne(row.id)}/>}
              </td>}

              {displayOrder.map((key, i) => (
                <td key={key} style={{
                  width:colWidth(key), minWidth:colWidth(key), height:T.attioRowH,
                  borderBottom:`1px solid ${T.attioLine}`, borderRight:`1px solid ${T.attioLine}`,
                  padding:'0 12px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                  color: !row[key] ? T.attioFaint : (key==='email' ? T.attioBlue : T.attioText),
                  background: draggingKey === key ? T.blueLight : 'transparent',
                  ...cellFreeze(i, false),
                  ...(draggingKey === key ? {background:T.blueLight} : {}),
                  ...focusBg(row),
                }}>
                  {/* Contact keeps Attio's primary-record treatment wherever it sits. */}
                  {renderCell && renderCell(key, row) !== undefined ? renderCell(key, row) : key === 'name' ? (
                    /* Same clickable name as the Board cards; opens the Contact Detail panel. */
                    <ContactName name={row.name} onOpen={()=>onOpenContact(row)}
                      style={{fontSize:'inherit', fontWeight:500}}/>
                  ) : isExtendedKey(key) ? (extendedValueText(key, row) || '—') : (formatValue(row[key]) || (row[key] === 0 ? 0 : '—'))}
                </td>
              ))}

              <td style={{
                position: actionsFrozen ? 'sticky' : 'static', right:0,
                zIndex: actionsFrozen ? 2 : 1, background: actionsFrozen ? T.headerBg : '#fff',
                width:ACTIONS_WIDTH, minWidth:ACTIONS_WIDTH, height:T.attioRowH,
                borderBottom:`1px solid ${T.attioLine}`,
                borderLeft: actionsFrozen && frozenRight===0
                  ? `2px solid ${stickyBorderColor}` : `1px solid ${T.attioLine}`,
                padding:'0 12px', transition:'border-color 120ms', ...focusBg(row),
              }}>
                {renderActions ? renderActions(row) : <ContactActionsMenu contact={row} {...actions}/>}
              </td>
            </tr>
          ))}
          {/* Filters can now empty the grid too, so this no longer always blames the search
              box — quoting an empty search term read as: No contacts match "" */}
          {sortedRows.length === 0 && (
            <tr><td colSpan={displayOrder.length + (gutterOn ? 2 : 1)} style={{padding:'24px 12px', textAlign:'center', color:T.gray400}}>
              {rows.length === 0 ? `No ${plural} yet` : search ? `No ${plural} match "${search}"` : `No ${plural} match the current filters`}
            </td></tr>
          )}
        </tbody>
      </table>
      </div>

      {paginate && <Pagination page={page} totalPages={totalPages} onChange={setPage} totalRows={sortedRows.length} selectedCount={selected.size} noun={noun} nounPlural={plural}
        bulk={bulkItems && bulkItems.length ? <BulkActionsMenu items={bulkItems}/> : null}/>}

    </div>
  );
}

/* Pagination — matches the Prev / numbered pages / Next pattern from the Figma Users & Teams
   reference table. */
/* `selectedCount` renders at the bottom-left of this bar — the selection readout lives here
   rather than in a banner above the grid, so selecting rows never shifts the table down. */
function Pagination({page, totalPages, onChange, totalRows, selectedCount=0, noun='contact', nounPlural, bulk}){
  if (totalRows === 0) return null;
  const pages = [];
  for (let i=1; i<=totalPages; i++){
    if (i===1 || i===totalPages || Math.abs(i-page)<=1) pages.push(i);
    else if (pages[pages.length-1] !== '…') pages.push('…');
  }
  const btnStyle = (active) => ({
    minWidth:28, height:28, padding:'0 8px', borderRadius:6, border:`1px solid ${active ? T.blue : T.borderStrong}`,
    background: active ? T.blueLight : '#fff', color: active ? T.blue : T.gray800, fontSize:13,
    cursor:'pointer', fontWeight: active ? 600 : 400,
  });
  return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, padding:'10px 16px', borderTop:`1px solid ${T.border}`, flexShrink:0}}>
      <div style={{display:'flex', alignItems:'center', gap:12, fontSize:13, color:T.blue, minWidth:0}}>
        {selectedCount > 0 ? `${selectedCount} ${selectedCount>1 ? (nounPlural || noun + 's') : noun} selected` : ''}
        {selectedCount > 0 && bulk}
      </div>
      <div style={{display:'flex', alignItems:'center', gap:6, flexShrink:0}}>
        <button disabled={page===1} onClick={()=>onChange(page-1)} style={{...btnStyle(false), opacity: page===1?0.4:1, cursor: page===1?'default':'pointer'}}>← Prev</button>
        {pages.map((p,i)=> p==='…'
          ? <span key={'e'+i} style={{color:T.gray400, padding:'0 4px'}}>…</span>
          : <button key={p} onClick={()=>onChange(p)} style={btnStyle(p===page)}>{p}</button>)}
        <button disabled={page===totalPages} onClick={()=>onChange(page+1)} style={{...btnStyle(false), opacity: page===totalPages?0.4:1, cursor: page===totalPages?'default':'pointer'}}>Next →</button>
      </div>
    </div>
  );
}

/* Styled like a proper button (border + background, matching Export) rather than a bare
   text link — blue border/text when there's something to save, neutral/disabled otherwise. */
function SaveViewMenu({dirty, onSaveCopy, onSaveExisting}){
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{position:'relative'}}>
      <button disabled={!dirty} onClick={()=>setOpen(o=>!o)} onMouseDown={e=>e.stopPropagation()} style={{
        display:'flex', alignItems:'center', gap:6,
        border:`1px solid ${dirty ? T.blue : T.borderStrong}`, background:'#fff', borderRadius:8,
        padding:'7px 12px', fontSize:13, fontWeight:500,
        color: dirty ? T.blue : T.gray400,
        cursor: dirty ? 'pointer' : 'default',
      }}>Save View <Icon name="chevDown" size={T.chevronSize} color={dirty?T.blue:T.gray400}/></button>
      <MenuShell open={open} onClose={()=>setOpen(false)} anchorRight width={180}>
        <MenuItem label="Save as Copy" onClick={()=>{onSaveCopy(); setOpen(false);}}/>
        <MenuItem label="Save as Existing" onClick={()=>{onSaveExisting(); setOpen(false);}}/>
      </MenuShell>
    </div>
  );
}

/* Save as Existing confirmation. The very first view ("All contacts") is the default view,
   shared with everyone in the team/company — when overwriting that specific view, the warning
   is stronger and explicitly says the change affects everyone, not just the current user. */
function ConfirmOverwriteModal({viewName, isDefault, onConfirm, onCancel}){
  return (
    <div style={{position:'fixed', inset:0, background:'rgba(16,24,40,.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100}}>
      <div style={{background:'#fff', borderRadius:12, width:400, padding:24}}>
        <div style={{fontSize:16, fontWeight:600, color:T.gray800, marginBottom:8}}>Save changes to "{viewName}"?</div>
        <div style={{fontSize:13, color:T.gray600, lineHeight:1.5, marginBottom:isDefault ? 12 : 20}}>
          You're about to overwrite the existing saved view "{viewName}" with your current changes.
        </div>
        {isDefault && (
          <div style={{display:'flex', gap:8, background:'#FFF7E6', border:'1px solid #F5D98B', borderRadius:8, padding:'10px 12px', marginBottom:20}}>
            <span style={{fontSize:13}}>⚠️</span>
            <span style={{fontSize:12.5, color:'#8A6300', lineHeight:1.5}}>
              "{viewName}" is the <strong>default view, shared with everyone</strong> in your team/company. Saving will change what everyone sees.
            </span>
          </div>
        )}
        <div style={{display:'flex', justifyContent:'flex-end', gap:8}}>
          <button onClick={onCancel} style={{padding:'8px 14px', borderRadius:8, border:`1px solid ${T.borderStrong}`, background:'#fff', fontSize:13, cursor:'pointer'}}>Cancel</button>
          <button onClick={onConfirm} style={{padding:'8px 14px', borderRadius:8, border:'none', background:T.blue, color:'#fff', fontSize:13, cursor:'pointer', fontWeight:600}}>Save as Existing</button>
        </div>
      </div>
    </div>
  );
}

/* Save as Copy — asks for a name before creating the new view. */
function SaveAsCopyModal({defaultName, onCancel, onConfirm}){
  const [name, setName] = React.useState(defaultName);
  const canSave = name.trim().length > 0;
  return (
    <div style={{position:'fixed', inset:0, background:'rgba(16,24,40,.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100}}>
      <div style={{background:'#fff', borderRadius:12, width:400, padding:24}}>
        <div style={{fontSize:16, fontWeight:600, color:T.gray800, marginBottom:8}}>Save as Copy</div>
        <div style={{fontSize:13, color:T.gray600, lineHeight:1.5, marginBottom:16}}>
          This creates a new view with your current table configuration and changes. The original view is left untouched.
        </div>
        <label style={{fontSize:12.5, fontWeight:500, color:T.gray800, display:'block', marginBottom:6}}>View name</label>
        <input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Enter a view name"
          onKeyDown={e=>{ if(e.key==='Enter' && canSave) onConfirm(name.trim()); }}
          style={{width:'100%', padding:'9px 12px', border:`1px solid ${T.borderStrong}`, borderRadius:8, fontSize:13, marginBottom:20, fontFamily:'inherit'}}/>
        <div style={{display:'flex', justifyContent:'flex-end', gap:8}}>
          <button onClick={onCancel} style={{padding:'8px 14px', borderRadius:8, border:`1px solid ${T.borderStrong}`, background:'#fff', fontSize:13, cursor:'pointer'}}>Cancel</button>
          <button onClick={()=>onConfirm(name.trim())} disabled={!canSave} style={{
            padding:'8px 14px', borderRadius:8, border:'none', fontSize:13, fontWeight:600,
            background: canSave ? T.blue : T.borderStrong, color: canSave ? '#fff' : T.gray400,
            cursor: canSave ? 'pointer' : 'default',
          }}>Save view</button>
        </div>
      </div>
    </div>
  );
}

/* Table Settings — left: searchable properties with checkboxes; right: the selected columns in
   order, drag to reorder, removable. Actions is not a property, so it is shown as a fixed row
   that can be unfrozen but never removed.

   Freezing is offered per column, but stored as two counts (how many leading / trailing columns
   are frozen). Counts make non-contiguous freezing unrepresentable, so the rule "frozen columns
   stay contiguous from their side" holds by construction rather than by validation — the UI then
   only offers Freeze on the column adjacent to a frozen block, and Unfreeze on its edge. */
function TableSettingsModal({draft, setDraft, onApply, onClose}){
  const {properties, propByKey, canCreateProperty, extendedObject} = useRecordSchema();
  const [query, setQuery] = React.useState('');
  const dragIdx = React.useRef(null);
  const [dragOver, setDragOver] = React.useState(null);

  const {columnOrder, frozenLeft, frozenRight, actionsFrozen} = draft;
  const lastIdx = columnOrder.length - 1;
  const frozenTotal = frozenLeft + frozenRight + (actionsFrozen ? 1 : 0);
  const atMax = frozenTotal >= MAX_FROZEN;

  const set = (patch) => setDraft({...draft, ...patch});

  const toggleProperty = (key) => {
    if(columnOrder.includes(key)){
      const i = columnOrder.indexOf(key);
      set({
        columnOrder: columnOrder.filter(k=>k!==key),
        // a removed column must not leave a frozen block counting something that is gone
        frozenLeft:  i < frozenLeft  ? frozenLeft - 1  : frozenLeft,
        frozenRight: i > lastIdx - frozenRight ? frozenRight - 1 : frozenRight,
      });
    } else {
      // new columns land in the scrollable middle, just before any right-frozen block
      const at = columnOrder.length - frozenRight;
      const next = columnOrder.slice();
      next.splice(at, 0, key);
      set({columnOrder: next});
    }
  };

  const moveColumn = (from, to) => {
    if(from===to || from==null || to==null) return;
    const next = columnOrder.slice();
    const [m] = next.splice(from,1);
    next.splice(to,0,m);
    set({columnOrder: next});
  };

  const freezeLeftAt  = (i) => set({frozenLeft: i+1});
  const freezeRightAt = (i) => set({frozenRight: lastIdx - i + 1});
  const unfreezeLeft  = () => set({frozenLeft: frozenLeft-1});
  const unfreezeRight = () => set({frozenRight: frozenRight-1});

  const available = properties.filter(p =>
    p.label.toLowerCase().includes(query.trim().toLowerCase()));

  const rowBox = {
    display:'flex', alignItems:'center', gap:10, padding:'8px 10px',
    border:`1px solid ${T.borderStrong}`, borderRadius:8, background:'#fff', fontSize:13,
  };

  return (
    <div style={{position:'fixed', inset:0, zIndex:120, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div onClick={onClose} style={{position:'absolute', inset:0, background:'rgba(16,24,40,.35)'}}/>
      <div style={{
        position:'relative', width:900, maxWidth:'94vw', maxHeight:'88vh', background:'#fff',
        borderRadius:12, boxShadow:'0 16px 40px rgba(16,24,40,.24)', display:'flex', flexDirection:'column',
      }}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:`1px solid ${T.border}`}}>
          <span style={{fontSize:16, fontWeight:600, color:T.attioText}}>Choose which columns you see</span>
          <button onClick={onClose} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex'}}>
            <Icon name="close" size={16} color={T.gray600}/>
          </button>
        </div>

        <div style={{display:'flex', flex:1, minHeight:0}}>
          {/* Left — available properties */}
          <div style={{width:360, borderRight:`1px solid ${T.border}`, display:'flex', flexDirection:'column', minHeight:0}}>
            <div style={{padding:'14px 16px'}}>
              <div style={{position:'relative'}}>
                <div style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}>
                  <Icon name="search" size={13} color={T.gray400}/>
                </div>
                <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search columns…"
                  style={{width:'100%', padding:'8px 10px 8px 30px', fontSize:13, fontFamily:'inherit',
                          border:`1px solid ${T.borderStrong}`, borderRadius:8}}/>
              </div>
            </div>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px 8px'}}>
              <span style={{fontSize:11.5, fontWeight:600, letterSpacing:.4, color:T.gray400}}>PROPERTIES</span>
              {/* Creating a property is not defined yet — the affordance only. */}
              {canCreateProperty && <button title="Create a property" style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:2, color:T.gray600}}>
                <Icon name="plus" size={14} color={T.gray600}/>
              </button>}
            </div>
            <div style={{flex:1, overflowY:'auto', padding:'0 16px 16px', display:'flex', flexDirection:'column', gap:2}}>
              {available.map(p => (
                <div key={p.key} onClick={()=>toggleProperty(p.key)}
                  style={{display:'flex', alignItems:'center', gap:10, padding:'7px 6px', borderRadius:6, cursor:'pointer', fontSize:13, color:T.attioText}}>
                  <RowCheckbox checked={columnOrder.includes(p.key)} onChange={()=>toggleProperty(p.key)}/>
                  <span>{p.label}</span>
                </div>
              ))}
              {/* Customer Profile Properties and Accounting Properties, each a group to open. */}
              {extendedObject && <ExtendedPropertyGroups query={query} renderItem={(it) => (
                <div key={it.key} onClick={()=>toggleProperty(it.key)}
                  style={{display:'flex', alignItems:'center', gap:10, padding:'7px 6px', borderRadius:6, cursor:'pointer', fontSize:13, color:T.attioText}}>
                  <RowCheckbox checked={columnOrder.includes(it.key)} onChange={()=>toggleProperty(it.key)}/>
                  <span>{it.label}</span>
                </div>
              )}/>}
              {available.length === 0 && !(extendedObject && query.trim() && extendedItems().some(it => [it.label, it.group].some(x => x && x.toLowerCase().includes(query.trim().toLowerCase())))) && (
                <div style={{fontSize:12.5, color:T.gray400, padding:'8px 6px'}}>No properties match “{query}”.</div>
              )}
            </div>
          </div>

          {/* Right — selected columns */}
          <div style={{flex:1, display:'flex', flexDirection:'column', minHeight:0}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px 8px'}}>
              <span style={{fontSize:11.5, fontWeight:600, letterSpacing:.4, color:T.gray400}}>
                SELECTED COLUMNS ({columnOrder.length})
              </span>
              <span style={{fontSize:12, color: atMax ? T.red : T.gray400}}>
                Frozen {frozenTotal} of {MAX_FROZEN}
              </span>
            </div>

            {atMax && (
              <div style={{margin:'0 20px 8px', padding:'7px 10px', borderRadius:8, background:'#FDECEC', color:T.red, fontSize:12.5}}>
                Maximum of {MAX_FROZEN} frozen columns reached — unfreeze one to freeze another.
              </div>
            )}

            <div style={{flex:1, overflowY:'auto', padding:'0 20px 16px', display:'flex', flexDirection:'column', gap:6}}>
              {columnOrder.map((key, i) => {
                const p = propByKey(key);
                const fl = i < frozenLeft, fr = i > lastIdx - frozenRight;
                const canFreezeLeft  = !fl && !fr && i === frozenLeft && !atMax;
                const canFreezeRight = !fl && !fr && i === lastIdx - frozenRight && !atMax;
                const canUnfreeze    = (fl && i === frozenLeft-1) || (fr && i === lastIdx - frozenRight + 1);
                return (
                  <React.Fragment key={key}>
                    {i === frozenLeft && frozenLeft > 0 && (
                      <div style={{display:'flex', alignItems:'center', gap:8, color:T.gray400, fontSize:11.5}}>
                        <div style={{flex:1, height:1, background:T.border}}/>
                        <span>Above column(s) are frozen left</span>
                        <div style={{flex:1, height:1, background:T.border}}/>
                      </div>
                    )}
                    {frozenRight > 0 && i === lastIdx - frozenRight + 1 && (
                      <div style={{display:'flex', alignItems:'center', gap:8, color:T.gray400, fontSize:11.5}}>
                        <div style={{flex:1, height:1, background:T.border}}/>
                        <span>Below column(s) are frozen right</span>
                        <div style={{flex:1, height:1, background:T.border}}/>
                      </div>
                    )}
                    <div
                      draggable
                      onDragStart={()=>dragIdx.current=i}
                      onDragOver={(e)=>{e.preventDefault(); setDragOver(i);}}
                      onDragLeave={()=>setDragOver(null)}
                      onDrop={()=>{ moveColumn(dragIdx.current, i); dragIdx.current=null; setDragOver(null); }}
                      style={{...rowBox, cursor:'grab',
                        background: (fl||fr) ? T.pageBg : '#fff',
                        outline: dragOver===i ? `2px solid ${T.attioBlue}` : 'none', outlineOffset:-2}}>
                      <Icon name="dragHandle" size={15} color={T.gray400}/>
                      <span style={{flex:1, color:T.attioText}}>{p ? (p.extended ? extendedFullLabel(p) : p.label) : key}</span>
                      {canFreezeLeft && <button title="Freeze to the left" onClick={()=>freezeLeftAt(i)} style={freezeBtn}><Icon name="freeze" size={14} color={T.gray600}/></button>}
                      {canFreezeRight && <button title="Freeze to the right" onClick={()=>freezeRightAt(i)} style={freezeBtn}><Icon name="freeze" size={14} color={T.gray600}/></button>}
                      {canUnfreeze && <button title="Unfreeze" onClick={fl ? unfreezeLeft : unfreezeRight} style={{...freezeBtn, borderColor:T.attioBlue}}><Icon name="unfreeze" size={14} color={T.attioBlue}/></button>}
                      <button title="Remove column" onClick={()=>toggleProperty(key)}
                        style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', color:T.gray400}}>
                        <Icon name="close" size={14} color={T.gray400}/>
                      </button>
                    </div>
                  </React.Fragment>
                );
              })}

              {/* Actions is a fixed column, not a configurable property: permanently last, never
                  removable, never draggable — so it carries no drag handle and no remove control,
                  and is set apart from the list above by the same separator the grid uses. Its
                  frozen state is the only thing the user controls here. */}
              <div style={{borderTop:`1px solid ${T.attioLine}`, marginTop:4, paddingTop:10}}>
                <div style={{...rowBox, background:T.pageBg, cursor:'default', paddingLeft:14}}>
                  <span style={{flex:1, color:T.attioText}}>Actions</span>
                  <span style={{fontSize:11.5, color:T.gray400}}>Always last</span>
                  {actionsFrozen
                    ? <button title="Unfreeze" onClick={()=>set({actionsFrozen:false})} style={{...freezeBtn, borderColor:T.attioBlue}}><Icon name="unfreeze" size={14} color={T.attioBlue}/></button>
                    : <button title={atMax ? `Maximum of ${MAX_FROZEN} frozen columns reached` : 'Freeze to the right'}
                        disabled={atMax} onClick={()=>set({actionsFrozen:true})}
                        style={{...freezeBtn, opacity: atMax?0.4:1, cursor: atMax?'default':'pointer'}}><Icon name="freeze" size={14} color={T.gray600}/></button>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{display:'flex', alignItems:'center', gap:10, padding:'14px 20px', borderTop:`1px solid ${T.border}`}}>
          <button onClick={onApply} style={{border:'none', background:T.black, color:'#fff', borderRadius:8, padding:'9px 20px', fontSize:13, fontWeight:600, cursor:'pointer'}}>Apply</button>
        </div>
      </div>
    </div>
  );
}

const freezeBtn = {
  border:`1px solid ${T.borderStrong}`, background:'#fff', borderRadius:6,
  padding:4, cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
};

/* View Settings — the right-side drawer (kept per the product designer's earlier instruction,
   which overrode a compact modal). Each view is a draggable card: handle, name, Table/Board
   switcher, three-dot menu; table views also carry rows-per-page and Table Settings. Board
   behaviour is deliberately undefined — the switcher only records the choice. */
function ViewSettingsDrawer({views, activeViewId, setActiveViewId, onClose, onReorder, onToggleHide,
                             onClone, onDelete, onRename, onPatchView, onOpenTableSettings, onOpenCardSettings,
                             liveViewMode, livePipelineId}){
  /* Another object's board names its pipelines (`pipelineLabel`) and may have no Card settings
     (`cardSettings:false`); Contacts uses its own pipelines and Card settings. */
  const {boards, pipelineLabel = (id) => pipelineById(id).label, cardSettings = true} = useRecordSchema();
  /* The active view's unsaved toolbar state wins over what is persisted on it: flipping the
     toolbar's Table/Board switcher is exactly the moment the card must swap Table settings for
     Card settings, and that switch does not save the view. Other views show what they stored. */
  const modeOf = (v) => v.id === activeViewId ? liveViewMode : v.viewMode;
  const pipelineOf = (v) => v.id === activeViewId ? livePipelineId : v.pipelineId;
  const dragIdx = React.useRef(null);
  const [editingId, setEditingId] = React.useState(null);
  const [editValue, setEditValue] = React.useState('');
  const [menuFor, setMenuFor] = React.useState(null);

  return (
    <div style={{position:'fixed', inset:0, zIndex:90}}>
      <div onClick={onClose} style={{position:'absolute', inset:0, background:'rgba(16,24,40,.25)'}}/>
      <div style={{position:'absolute', top:0, right:0, bottom:0, width:400, background:'#fff', boxShadow:'-8px 0 24px rgba(16,24,40,.16)', display:'flex', flexDirection:'column'}}>
        <div style={{display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background:T.headerBg, borderBottom:`1px solid ${T.border}`, flexShrink:0}}>
          <button onClick={onClose} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', color:T.gray600}}><Icon name="close" size={14} color={T.gray600}/></button>
          <span style={{fontSize:14, fontWeight:500, color:T.black}}>View Settings</span>
        </div>

        <div style={{padding:14, display:'flex', flexDirection:'column', gap:10, overflowY:'auto', flex:1}}>
          {views.map((v, idx) => (
            <div key={v.id}
              draggable
              onDragStart={()=>dragIdx.current = idx}
              onDragOver={(e)=>e.preventDefault()}
              onDrop={()=>{ onReorder(dragIdx.current, idx); dragIdx.current = null; }}
              onClick={()=> editingId!==v.id && setActiveViewId(v.id)}
              style={{
                border:`1px solid ${activeViewId===v.id ? T.attioBlue : T.borderStrong}`,
                borderRadius:10, padding:'10px 12px', background:'#fff', cursor:'pointer',
                opacity: v.hidden ? 0.5 : 1, display:'flex', flexDirection:'column', gap:10,
              }}>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <span style={{display:'flex', cursor:'grab'}}><Icon name="dragHandle" size={16} color={T.gray400}/></span>

                {editingId === v.id ? (
                  <input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)}
                    onBlur={()=>{ onRename(v.id, editValue.trim()||v.name); setEditingId(null); }}
                    onKeyDown={e=>{ if(e.key==='Enter') e.currentTarget.blur(); }}
                    onClick={e=>e.stopPropagation()}
                    style={{flex:1, fontSize:13, border:`1px solid ${T.blue}`, borderRadius:4, padding:'2px 6px', fontFamily:'inherit'}}/>
                ) : (
                  <span style={{flex:1, fontSize:13.5, color:T.attioText, fontWeight: activeViewId===v.id?600:500}}>{v.name}</span>
                )}

                {/* Table / Board switcher */}
                {boards && <div onClick={e=>e.stopPropagation()} style={{display:'flex', alignItems:'center', gap:2, border:`1px solid ${T.borderStrong}`, borderRadius:8, padding:2}}>
                  {[['table','tableView','Table'], ['board','kanbanView','Board']].map(([mode, icon, title]) => (
                    <button key={mode} title={title} onClick={()=>onPatchView(v.id, {viewMode:mode})}
                      style={{border:'none', borderRadius:6, padding:'4px 7px', cursor:'pointer', display:'flex',
                              background: modeOf(v)===mode ? T.headerBg : 'transparent'}}>
                      <Icon name={icon} size={14} color={modeOf(v)===mode ? T.gray800 : T.gray400}/>
                    </button>
                  ))}
                </div>}

                <div style={{position:'relative'}} onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>setMenuFor(menuFor===v.id?null:v.id)} style={{border:'none', background:'transparent', cursor:'pointer', display:'flex', padding:2}}>
                    <Icon name="moreDots" size={15} color={T.gray400}/>
                  </button>
                  <MenuShell open={menuFor===v.id} onClose={()=>setMenuFor(null)} anchorRight width={170}>
                    <MenuItem label={v.name ? 'Rename' : 'Add name'} onClick={()=>{ setEditValue(v.name); setEditingId(v.id); setMenuFor(null); }}/>
                    <MenuItem label="Clone" onClick={()=>{ onClone(v.id); setMenuFor(null); }}/>
                    <MenuItem label={v.hidden ? 'Unhide' : 'Hide'} onClick={()=>{ onToggleHide(v.id); setMenuFor(null); }}/>
                    <MenuItem label="Delete" danger onClick={()=>{ onDelete(v.id); setMenuFor(null); }}/>
                  </MenuShell>
                </div>
              </div>

              {/* Table-only settings */}
              {modeOf(v) === 'table' && (
                <div onClick={e=>e.stopPropagation()} style={{display:'flex', alignItems:'center', gap:10, paddingLeft:24}}>
                  <span style={{fontSize:12.5, color:T.gray600, flexShrink:0}}>No of rows</span>
                  {/* Native select arrows sit hard against the field edge, so the chevron is drawn
                      over an appearance:none select with room reserved for it. */}
                  <div style={{position:'relative', flexShrink:0}}>
                    <select value={v.rowsPerPage} onChange={e=>onPatchView(v.id, {rowsPerPage: +e.target.value})}
                      style={{appearance:'none', WebkitAppearance:'none', MozAppearance:'none',
                              border:`1px solid ${T.borderStrong}`, borderRadius:8,
                              padding:'4px 30px 4px 10px', fontSize:12.5, fontFamily:'inherit',
                              cursor:'pointer', color:T.attioText, background:'#fff'}}>
                      {ROWS_PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <div style={{position:'absolute', right:9, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex'}}>
                      <Icon name="chevDown" size={T.chevronSize} color={T.gray600}/>
                    </div>
                  </div>
                  {/* Table settings sits at the far right of the card. */}
                  <button onClick={()=>onOpenTableSettings(v.id)}
                    style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:6, border:`1px solid ${T.borderStrong}`, background:'#fff', borderRadius:8, padding:'5px 10px', fontSize:12.5, color:T.gray800, cursor:'pointer', flexShrink:0}}>
                    <Icon name="settingsGear" size={13} color={T.gray600}/> Table settings
                  </button>
                </div>
              )}

              {/* Board-only settings. A board has no rows-per-page — its columns scroll — so
                  that control is absent rather than disabled, and Table settings is replaced
                  by Card settings, which sets what the view's Board cards show. */}
              {modeOf(v) === 'board' && (
                <div onClick={e=>e.stopPropagation()} style={{display:'flex', alignItems:'center', gap:10, paddingLeft:24}}>
                  <span style={{fontSize:12.5, color:T.gray600, flexShrink:0}}>{pipelineLabel(pipelineOf(v))}</span>
                  {cardSettings && <button onClick={()=>onOpenCardSettings(v.id)}
                    style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:6, border:`1px solid ${T.borderStrong}`, background:'#fff', borderRadius:8, padding:'5px 10px', fontSize:12.5, color:T.gray800, cursor:'pointer', flexShrink:0}}>
                    <Icon name="settingsGear" size={13} color={T.gray600}/> Card settings
                  </button>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
const rowIconBtn = {border:'none', background:'transparent', cursor:'pointer', padding:0, display:'flex', alignItems:'center'};

/* ── Record toolbar ── the one toolbar for every record list (Contacts, Deals, Settings tables).
   Row 1: the view pills (scrolling on their own), View Settings + Save View, then the page
   controls (pipeline selector, Table / Board switcher, Export, +). Row 2: search + Filters (+ Clear
   all). `inset` is the only variation: 'page' for a CRM page (Contacts, Deals: 16/20/12 and 12/20),
   'settings' for a table inside a Settings page (12/16), whose page already pads around it. */
const toolbarButton = {display:'flex', alignItems:'center', gap:6, border:`1px solid ${T.borderStrong}`, background:'#fff', borderRadius:8,
  padding:'7px 12px', fontSize:13, color:T.gray800, cursor:'pointer', fontFamily:'inherit'};
const toolbarIconButton = {width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center',
  border:`1px solid ${T.borderStrong}`, background:'#fff', borderRadius:8, cursor:'pointer', flexShrink:0};
const TOOLBAR_INSETS = {page:{row1:'16px 20px 12px', row2:'12px 20px'}, settings:{row1:'12px 16px', row2:'12px 16px'}};

/* Table / Board switcher — the toolbar's segmented control. */
function TableBoardSwitch({mode, onChange}){
  return (
    <div style={{display:'flex', alignItems:'center', gap:2, border:`1px solid ${T.borderStrong}`, borderRadius:8, padding:2}}>
      {[['table', 'tableView', 'Table'], ['board', 'kanbanView', 'Board']].map(([m, icon, title]) => (
        <button key={m} onClick={()=>onChange(m)} title={title} style={{border:'none', borderRadius:6, padding:'6px 8px', cursor:'pointer', display:'flex',
          background: mode === m ? T.headerBg : 'transparent'}}>
          <Icon name={icon} size={15} color={mode === m ? T.gray800 : T.gray400}/>
        </button>
      ))}
    </div>
  );
}

/* `filterControls`: on the far right of the filters row (e.g. Deals → Violations). */
function RecordToolbar({inset = 'page', views, activeViewId, onSelectView, viewControls, controls, search, onSearch, filters, setFilters, appliedFilterCount, filterControls}){
  const [showFilters, setShowFilters] = React.useState(false);
  const pad = TOOLBAR_INSETS[inset] || TOOLBAR_INSETS.page;
  return (<>
    {/* Row 1. No page title — the CRM navigation already provides that context. The view pills
        scroll horizontally on their own; View Settings and Save View sit outside that scrolling
        wrapper so their menus are never clipped by it. */}
    <div style={{display:'flex', alignItems:'center', gap:16, padding:pad.row1, borderBottom:`1px solid ${T.border}`}}>
      <div style={{display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0, overflowX:'auto'}}>
        {views.map(v => {
          const isActive = activeViewId === v.id;
          return (
            <button key={v.id} onClick={()=>onSelectView(v.id)} style={{
              border:`1px solid ${isActive ? T.black : T.borderStrong}`,
              background: isActive ? T.black : '#fff', cursor:'pointer', fontSize:13,
              padding:'6px 12px', borderRadius:8, fontWeight: isActive ? 600 : 500,
              color: isActive ? '#fff' : T.gray800, flexShrink:0, fontFamily:'inherit',
            }}>{v.name}</button>
          );
        })}
      </div>
      {viewControls && <div style={{display:'flex', alignItems:'center', gap:8, flexShrink:0}}>{viewControls}</div>}
      {controls && <div style={{display:'flex', alignItems:'center', gap:10, flexShrink:0}}>{controls}</div>}
    </div>

    {/* Row 2: Search + Filters */}
    <div style={{display:'flex', alignItems:'center', gap:10, padding:pad.row2, borderBottom:`1px solid ${T.border}`}}>
      <div style={{position:'relative'}}>
        <div style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none'}}><Icon name="search" size={13} color={T.gray400}/></div>
        <input value={search} onChange={e=>onSearch(e.target.value)} placeholder="Find or Ask"
          style={{padding:'7px 10px 7px 30px', fontSize:13, border:`1px solid ${T.borderStrong}`, borderRadius:8, width:200, fontFamily:'inherit'}}/>
      </div>
      {/* The modal opens where the button is, so it is anchored inside this wrapper. */}
      <div style={{position:'relative'}}>
        <button onClick={()=>setShowFilters(o=>!o)} style={{...toolbarButton,
          border:`1px solid ${appliedFilterCount ? T.attioBlue : T.borderStrong}`,
          background: appliedFilterCount ? T.blueLight : '#fff',
          color: appliedFilterCount ? T.attioBlue : T.gray800,
        }}>
          <Icon name="filter" size={13} color={appliedFilterCount ? T.attioBlue : T.gray600}/>
          {appliedFilterCount ? `Filter ${appliedFilterCount}` : 'Filters'}
        </button>
        {showFilters && <FilterModal filters={filters} setFilters={setFilters} onClose={()=>setShowFilters(false)}/>}
      </div>
      {appliedFilterCount > 0 && (
        <button onClick={()=>setFilters(EMPTY_FILTERS())} style={{
          border:'none', background:'transparent', color:T.gray600, fontSize:12.5,
          cursor:'pointer', padding:'7px 2px', textDecoration:'underline',
          textDecorationColor:'#D7D6DA', textUnderlineOffset:2, fontFamily:'inherit',
        }}>Clear all</button>
      )}
      {filterControls && <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:8}}>{filterControls}</div>}
    </div>
  </>);
}

/* `contacts` / `setContacts` come from the app (so a workflow prompt can create a contact);
   without them the module keeps its own list. */
/* A new contact record — every creation path (Add contact, Create through associated object, a
   workflow's Create Associated Object) builds it here: `vals` are the form's values (owner: a
   user ID). Everything else starts empty; Create Date is today; created by hand → Source Manual. */
const newContactRecord = (id, vals) => ({
  id, name:'', email:'', phone:'', owner:'', contactType:'', company:'', industry:'', leadStatus:'', lastActivity:'', jobTitle:'', lifecycle:'',
  city:'', country:'', source:'Manual', lastContacted:'', dealCount:0, ...vals, created:todayLabel(),
});

/* A contact as the screens show it: the owner (a user ID on the record) as the user's name, with
   the ID kept as `ownerId`. Lists, boards, filters and the contact page read these rows; changes
   are written to the record (owner as an ID). */
const contactView = (c) => c && {...c, owner:userLabel(c.owner), ownerId:c.owner};
// Activated users as owner options (value: the user ID).
const ownerUserOptions = (users) => (users || []).filter(u => u.status === 'Activated').map(u => ({value:u.id, label:u.name}));

/* Shared with Deals (App): `activities` (each contact's history), `profileStore` (Customer
   Profiles: {profiles, facts, save}), `dealData` (Settings data, for Create Deal), `dealsFor(id)`
   (a contact's deals as list rows), `onCreateDeal(contact, values)` → the new deal,
   `onOpenDeal(id, mode)`, and `openRequest` ({id, mode, tab, nonce}) to open a contact from
   elsewhere (a deal). Without them the module keeps its own state, as before. */
function ContactsModule({contactProperties, contacts:sharedContacts, setContacts:setSharedContacts, activities:sharedActivities, setActivities:setSharedActivities,
                         profileStore, dealData, deals, dealsFor, onCreateDeal, onLinkDeal, onOpenDeal, openRequest, dealActivitiesFor, updateDealActivity,
                         customers, customersFor, onCreateCustomer, onLinkCustomer, onOpenCustomer, onRecordDeleted}){
  const hub = useRecordHub();   // the composer and quotations (recordHub.jsx)
  // The Contact object's properties (Settings → Properties): custom ones join the table's columns and filters.
  /* Filter by associated object → Deals: whether a contact has deals, and every Deal filter
     property (a contact matches when any of its deals does). `deals`: the deal records (App). */
  const dealAssoc = React.useMemo(()=>dealData && deals ? assocFilterSchema('Deals', 'Deal', dealFilterSchema(dealData), 'Has associated deals') : null,
    [dealData && dealData.properties, dealData && dealData.pipelines, dealData && dealData.users, !!deals]);
  const objectSchema = React.useMemo(()=>{ const own = customContactSchema(contactProperties); const withDeals = dealAssoc ? withAssocFilters(own, dealAssoc) : own;
    return dealData ? withScopeFilters(withDeals, dealData, 'contacts') : withDeals; }, [contactProperties, dealAssoc, dealData]);
  // The contact panel's and the board card's properties — the Contact properties in Settings.
  const panelKind = React.useMemo(()=>contactPanelKind(contactProperties), [contactProperties]);
  const cardProperties = React.useMemo(()=>[...objectSchema.properties.filter(p => !['name', 'deals'].includes(p.key)),
    {key:'deals', label:(objectSchema.properties.find(p => p.key === 'deals') || {}).label || 'Associated Deals'}, ...extendedProps()], [objectSchema]);
  const [ownContacts, setOwnContacts] = React.useState(SAMPLE_CONTACTS);
  const records = sharedContacts || ownContacts, setContacts = setSharedContacts || setOwnContacts;
  // What the screens show (owner names); `records` are what's stored (owner IDs).
  const users = (dealData && dealData.users) || [];
  const contacts = React.useMemo(() => records.map(contactView), [records, users]);
  const recordOf = (id) => records.find(c => c.id === id);
  /* Activity history, keyed by contact id — one list per Contact record. */
  const [ownActivities, setOwnActivities] = React.useState(()=>sharedActivities ? {} : generateActivities(SAMPLE_CONTACTS));
  const activities = sharedActivities || ownActivities, setActivities = setSharedActivities || setOwnActivities;
  // The first view is the default view, shared with everyone in the team/company.
  const [views, setViews] = usePersistedState('views:contacts', ()=>[makeView('v1', 'All contacts', {isDefault:true})]);   // saved (store.jsx)
  const [activeViewId, setActiveViewId] = React.useState('v1');
  const [deletingView, setDeletingView] = React.useState(null);   // a saved view asked to be deleted
  const [allViewsOpen, setAllViewsOpen] = React.useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = React.useState(false);
  const [showSaveAsCopy, setShowSaveAsCopy] = React.useState(false);
  const [tableSettingsDraft, setTableSettingsDraft] = React.useState(null);
  const [cardSettingsDraft, setCardSettingsDraft] = React.useState(null);
  /* Contact side panel layout (View Settings from the contact's ⋯ menu) — one setting for every
     contact, side panel and full page alike. */
  const [panelSettingsSaved, setPanelSettings] = usePersistedState('panel:contacts', DEFAULT_PANEL_SETTINGS);
  const panelSettings = withContactPanelProperties(panelSettingsSaved, contactProperties);
  const [panelSettingsDraft, setPanelSettingsDraft] = React.useState(null);
  const [contactForm, setContactForm] = React.useState(null);   // {mode:'add'|'edit', initial, id?}
  const [pendingDelete, setPendingDelete] = React.useState(null);
  const [changingOwner, setChangingOwner] = React.useState(null);   // the contact whose owner is being changed
  const [enrichFor, setEnrichFor] = React.useState(null);
  const [activityStub, setActivityStub] = React.useState(null);
  /* Customer Profile Builder (prototype). Facts are shared per contact across templates;
     profiles are per contact per template (a snapshot of the values used and the score). */
  const [callFor, setCallFor] = React.useState(null);          // contact id with an open call
  const [profileRun, setProfileRun] = React.useState(null);    // {contactId, call}
  const [ownFacts, setOwnFacts] = React.useState({});    // {contactId: {fieldKey: fact}}
  const [ownProfiles, setOwnProfiles] = React.useState({});    // {contactId: {templateId: profile}}
  const profileFacts = profileStore ? profileStore.facts : ownFacts;
  const profiles = profileStore ? profileStore.profiles : ownProfiles;
  const [creatingDeal, setCreatingDeal] = React.useState(null);   // the contact a deal is being created from
  // Activity views on the contact's activity tabs (activityViews.jsx) — one set for every contact.
  const [activityViewState, setActivityViewState] = React.useState({});
  const [profilePrompt, setProfilePrompt] = React.useState(null); // after Create Deal: the contact without a profile
  /* Contact Detail: which contact is open and how. Stored by id so edits made elsewhere show
     immediately, and a deleted contact closes its detail. */
  const [detail, setDetail] = React.useState(null);   // {id, mode:'panel'|'full'}
  const openContact = (c) => setDetail(d => ({id:c.id, mode: d && d.mode === 'full' ? 'full' : 'panel'}));
  // Opened from elsewhere (the contact on a deal): in the mode it came from.
  React.useEffect(() => {
    if(openRequest && contacts.some(c => c.id === openRequest.id)) setDetail({id:openRequest.id, mode:openRequest.mode || 'panel',
      tab: openRequest.tab ? {id:openRequest.tab, nonce:openRequest.nonce} : undefined});
  }, [openRequest && openRequest.nonce]);
  const [toast, setToast] = React.useState(null);   // {message, action?}
  const toastTimer = React.useRef(null);
  const showToast = (msg, action) => {
    setToast({message:msg, action});
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(()=>setToast(null), action ? 5000 : 1800);
  };

  const activeView = views.find(v=>v.id===activeViewId) || views[0];
  const [columnOrder, setColumnOrder] = React.useState(activeView.columnOrder);
  const [sort, setSort] = React.useState(activeView.sort);
  const [viewMode, setViewMode] = React.useState(activeView.viewMode);
  const [pipelineId, setPipelineId] = React.useState(activeView.pipelineId || 'typesOfContact');
  const [search, setSearch] = React.useState(activeView.search);
  const [filters, setFilters] = React.useState(activeView.filters || EMPTY_FILTERS());
  const [frozenLeft, setFrozenLeft] = React.useState(activeView.frozenLeft ?? 1);
  const [frozenRight, setFrozenRight] = React.useState(activeView.frozenRight ?? 0);
  const [actionsFrozen, setActionsFrozen] = React.useState(activeView.actionsFrozen ?? true);
  const [rowsPerPage, setRowsPerPage] = React.useState(activeView.rowsPerPage ?? 25);
  const [cardSettings, setCardSettings] = React.useState(activeView.cardSettings || DEFAULT_CARD_SETTINGS());

  React.useEffect(()=>{
    setColumnOrder(activeView.columnOrder);
    setSort(activeView.sort);
    setViewMode(activeView.viewMode);
    setPipelineId(activeView.pipelineId || 'typesOfContact');
    setSearch(activeView.search);
    setFilters(activeView.filters || EMPTY_FILTERS());
    setFrozenLeft(activeView.frozenLeft ?? 1);
    setFrozenRight(activeView.frozenRight ?? 0);
    setActionsFrozen(activeView.actionsFrozen ?? true);
    setRowsPerPage(activeView.rowsPerPage ?? 25);
    setCardSettings(activeView.cardSettings || DEFAULT_CARD_SETTINGS());
  }, [activeViewId]);

  const dirty = JSON.stringify(columnOrder) !== JSON.stringify(activeView.columnOrder)
    || JSON.stringify(sort) !== JSON.stringify(activeView.sort)
    || viewMode !== activeView.viewMode
    || pipelineId !== (activeView.pipelineId || 'typesOfContact')
    || search !== activeView.search
    || JSON.stringify(filters) !== JSON.stringify(activeView.filters || EMPTY_FILTERS())
    || frozenLeft !== (activeView.frozenLeft ?? 1)
    || frozenRight !== (activeView.frozenRight ?? 0)
    || actionsFrozen !== (activeView.actionsFrozen ?? true)
    || rowsPerPage !== (activeView.rowsPerPage ?? 25)
    || JSON.stringify(cardSettings) !== JSON.stringify(activeView.cardSettings || DEFAULT_CARD_SETTINGS());

  // Board cards' activity: what the acting user may see on each contact (tool permissions).
  const shownActivities = Object.fromEntries(contacts.map(c => [c.id, visibleActivities('contacts', c, activities[c.id])]));
  const filteredContacts = React.useMemo(()=>{
    if(!dealAssoc) return applyFilters(contacts, filters, objectSchema.filterProps);
    // Filtered with each contact's deals alongside; the contacts themselves are what's listed.
    const rows = contacts.map(c => withAssocRecords(c, 'Deals', deals.filter(d => d.contactId === c.id).map(d => dealRowOf(dealData, d))));
    const ok = new Set(applyFilters(rows, filters, objectSchema.filterProps).map(r => r.id));
    return contacts.filter(c => ok.has(c.id));
  }, [contacts, filters, objectSchema, deals, dealData]);

  /* Owners are Users (Settings → Users & Teams): activated users, stored by ID. `ownerOptions`
     are their names, for the activity forms' people lists (resolved back to IDs when saved). */
  const ownerChoices = React.useMemo(()=>ownerUserOptions(users), [users]);
  const ownerOptions = React.useMemo(()=>ownerChoices.map(o => o.label), [ownerChoices]);

  /* One set of callbacks for both the table row menu and the board card menu. */
  const contactActions = {
    onEdit:    (c) => setContactForm({mode:'edit', id:c.id, initial:recordOf(c.id)}),   // the record: owner as its ID
    onDelete:  (c) => setPendingDelete(c),
    onEnrich:  (c) => setEnrichFor(c),
    onCopied:  showToast,
    onCall:    (c) => startCallFor(c.id),
    // Edit Contact Owner: the owner modal (the change is recorded as an owner-change activity).
    onOwner:   (c) => setChangingOwner(recordOf(c.id)),
    /* Create Deal opens Create Deal for the contact; Create Customer, a new customer linked to the
       contact (Contacts ↔ Customers). */
    onCreateRecord: (label, c) => /^create deal$/i.test(label) && onCreateDeal && c ? setCreatingDeal(c)
      : /^create customer$/i.test(label) && onCreateCustomer && c ? onCreateCustomer({contact:recordOf(c.id)})
      : setActivityStub(label),   // menu: Create Deal; quick action: Create Deal
    // The ⋯ menu's tools (contactToolAction).
    onTool: (key, c) => contactToolAction(key, c),
    /* Associated Deals: one deal (or the deal picked, `dealId`) opens it; several open the contact's Deals tab. */
    onOpenDeals: (c, dealId) => {
      const ds = dealsFor ? dealsFor(c.id) : [];
      const mode = detail && detail.mode === 'full' ? 'full' : 'panel';
      if(dealId && onOpenDeal) onOpenDeal(dealId, mode);
      else if(ds.length === 1 && onOpenDeal) onOpenDeal(ds[0].id, mode);
      else if(ds.length) setDetail({id:c.id, mode:'full', tab:{id:'deals', nonce:Date.now()}});
    },
    // Associated Customers: one customer (or the customer picked, `customerId`) opens it; several open the contact's Customers tab.
    onOpenCustomers: (c, customerId) => {
      const cs = customersFor ? customersFor(c.id) : [];
      const mode = detail && detail.mode === 'full' ? 'full' : 'panel';
      if(customerId && onOpenCustomer) onOpenCustomer(customerId, mode);
      else if(cs.length === 1 && onOpenCustomer) onOpenCustomer(cs[0].id, mode);
      else if(cs.length) setDetail({id:c.id, mode:'full', tab:{id:'customers', nonce:Date.now()}});
    },
    // The contact's Deals tab: its deals; each opens on the Deals page.
    renderTab: (tab, openTab, q) => tab.id === 'deals' && dealsFor && detail ? (
      <AssociatedRecords columns={ASSOCIATED_DEAL_COLUMNS} rows={dealsFor(detail.id)} q={q} empty="No deals for this contact yet."
        onOpen={(d)=>onOpenDeal && onOpenDeal(d.id, detail.mode)}/>
    ) : tab.id === 'customers' && customersFor && detail ? (
      <AssociatedRecords columns={ASSOCIATED_CUSTOMER_COLUMNS} rows={customersFor(detail.id)} q={q} empty="No customers for this contact yet."
        onOpen={(x)=>onOpenCustomer && onOpenCustomer(x.id, detail.mode)}/>
    ) : undefined,
    /* Create a profile from the Customer Profile tab: same flow, template pre-chosen. Uses the
       contact's latest call — its Sales Notes and transcript — when there is one; otherwise fields start empty. */
    onCreateProfile: (c, templateId) => {
      const lastCall = (activities[c.id] || []).find(a => a.type === 'call' && ((a.transcript && a.transcript.length) || a.notes));
      setProfileRun({contactId:c.id, templateIds: templateId ? [templateId] : undefined,
        call: lastCall ? {id:lastCall.id, segments:lastCall.transcript || [], notes:lastCall.notes || '', startedAt:lastCall.at} : null});
    },
  };
  /* The Table's row menu also carries the activity actions. Call opens the call interface;
     the others are not defined yet and open the same placeholder the Board card's icons do. */
  const tableRowActions = {...contactActions, onActivity: (title, c) => title === 'Call' ? startCallFor(c.id) : setActivityStub(title)};
  /* Tools in the ⋯ menu: Call opens the call window; Task and Note open the contact on that tab
     with its form; File and Quote, on the Files and Quotes tabs. Email and Meeting aren't defined
     yet (placeholder), as everywhere else. */
  const contactToolAction = (key, c) => {
    if(key === 'call') return startCallFor(c.id);
    // Email: the composer; Quote: a new quotation for the contact (recordHub.jsx).
    if(key === 'email' && hub) return hub.composeEmail({object:'contacts', id:c.id});
    if(key === 'quote' && hub) return hub.newQuote({object:'contacts', id:c.id});
    const tab = {task:{id:'tasks', adding:'Task'}, note:{id:'notes', adding:'Note'}, file:{id:'files'}, meeting:{id:'meetings', adding:'Schedule Meeting'}}[key];
    if(tab) setDetail({id:c.id, mode:'full', tab:{...tab, nonce:Date.now()}});
  };

  /* A finished call becomes a Call activity carrying its transcript, and counts as the
     contact's latest touchpoint. Sales Notes taken during the call are saved as a Note on the
     contact at the same moment, linked to the call. */
  // One call at a time: another contact's call can't start while a call's panel is open (it would be saved on the wrong contact).
  const startCallFor = (id) => { const c = contacts.find(x => x.id === id);
    if(!c || !String(c.phone || '').trim()) return showToast('No phone number to call');
    setCallFor(cur => { if(cur != null && cur !== id){ showToast('Finish the current call first'); return cur; } return id; }); };
  const endCall = (contactId, {startedAt, durationMs, segments, lang, notes = ''}) => {
    const id = `call-${contactId}-${Date.now()}`;
    const activity = {id, contactId, type:'call', at:startedAt, source:'you', by:CURRENT_USER.name, direction:'outbound',
      outcome:'Connected', logged:false,   // a live call from the app: read-only
      durationMin: Math.max(1, Math.round(durationMs / 60000)),
      body: segments.length ? `Live transcript · ${segments.length} lines` : 'No transcript captured',
      transcript: segments, notes, lang};
    const note = notes ? {id:`note-${id}`, contactId, type:'note', at:new Date(startedAt.getTime() + durationMs), source:'you', by:CURRENT_USER.name, body:notes, callId:id} : null;
    setActivities(m => ({...m, [contactId]: [...(note ? [note] : []), activity, ...(m[contactId] || [])]}));
    const today = todayLabel();
    setContacts(cs => cs.map(c => c.id === contactId ? {...c, lastActivity:today} : c));   // Last Contacted follows the activity (App)
    return {id, contactId, startedAt, durationMs, segments, notes};
  };

  /* Activity tabs write here — the one activity store the Overview, cards and side panel read.
     New items are this session's ("You"); a logged call also counts as the latest contact. */
  const updateActivity = (contactId, id, patch) => {
    // A deal's activity (Deal activity view) is saved on its deal.
    if(updateDealActivity && !(activities[contactId] || []).some(a => a.id === id)) return updateDealActivity(id, patch);
    setActivities(m => ({...m, [contactId]: (m[contactId] || []).map(a => a.id === id ? {...a, ...patch} : a)}));
  };
  const addActivity = (contactId, act) => {
    // What a person adds carries their name (the history keeps who did it).
    const a = {id:`${act.type}-${contactId}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, contactId, at:new Date(), ...act, ...(act.source === 'you' && !act.by ? {by:CURRENT_USER.name} : {})};
    setActivities(m => ({...m, [contactId]: [a, ...(m[contactId] || [])]}));
    const today = todayLabel();
    setContacts(cs => cs.map(c => c.id === contactId ? {...c, lastActivity:today} : c));   // Last Contacted follows the activity (App)
  };

  /* Confirmed answers merge into the contact's shared facts; each selected template gets a
     saved profile snapshot. Then the Contact Detail opens on the Customer Profile tab. */
  // The form is saved by the fill panel itself (customerProfile.jsx); then the contact opens on it.
  const saveProfileRun = (contactId, summary) => {
    setProfileRun(null);
    setDetail({id:contactId, mode:'full', tab:{id:'profile', nonce:Date.now()}});
    showToast(`Customer Profile saved · ${summary.formName}`);
  };

  /* The single way an existing contact is updated (used by the Edit contact form). Owner changes are part of the activity history, so
     a reassignment records one; otherwise the history would still end on the previous owner.
     It is attributed to 'You' (this session): there is no signed-in user, so no name is assumed. */
  // Latest contacts, so back-to-back updates (before a re-render) compare against fresh data.
  const contactsRef = React.useRef(records);
  contactsRef.current = records;
  const updateContact = (id, patch0) => {
    // The owner is stored as a user ID (a name picked from a people list is looked up).
    const patch = 'owner' in patch0 ? {...patch0, owner:userIdOf(patch0.owner, users)} : patch0;
    const prev = contactsRef.current.find(c => c.id === id);
    if(!prev) return;
    if(Object.keys(patch).every(k => (prev[k] || '') === (patch[k] || ''))) return;   // nothing changed
    contactsRef.current = contactsRef.current.map(c => c.id === id ? {...c, ...patch} : c);
    // An owner change is kept in the contact's history by the save itself (workflowEngine.jsx), once.
    setContacts(cs => cs.map(c => c.id === id ? {...c, ...patch} : c));
  };

  const saveContact = (vals, assoc) => {
    if(contactForm.mode === 'edit'){
      updateContact(contactForm.id, vals);
    } else {
      // A new, never-used ID (store.jsx) — never one a deleted contact had.
      const id = newRecordId('contacts');
      /* What the form collects (the properties available during creation), plus Create Date.
         Everything else starts empty — in particular there is no deal temperature, because
         nothing computes one yet. */
      const record = newContactRecord(id, vals);
      setContacts(cs => [...cs, record]);
      /* Associated records: a deal — an existing one without a contact, or a new one — and an
         existing customer without a contact (a deal or customer has one contact). */
      (assoc || []).forEach(a => {
        if(a.object === 'deals'){
          if(a.existingId && onLinkDeal) onLinkDeal(a.existingId, id);
          else if(a.values && onCreateDeal) onCreateDeal(record, a.values);
        }
        if(a.object === 'customers' && a.existingId && onLinkCustomer) onLinkCustomer(a.existingId, {contactId:id});
      });
    }
    setContactForm(null);
  };
  const appliedFilterCount = React.useMemo(()=>countAppliedFilters(filters, objectSchema.filterProps), [filters, objectSchema]);
  /* Add contact: Create through associated record → Deal — an existing deal that has no contact
     yet (a deal has one contact), or a new deal created with the contact; → Customer — an existing
     customer that has no contact yet (a customer has one contact). */
  const hasContact = (r) => r.contactId != null && records.some(c => c.id === r.contactId);
  const creatable = dealData ? creationAssociations(dealData, 'contacts') : [];
  const association = [
    ...(deals && creatable.includes('deals') ? [{object:'deals', noun:'deal',
      existing:deals.filter(d => !hasContact(d)).map(d => { const r = dealRowOf(dealData, d); return {value:d.id, label:`${d.name} · ${r.pipeline} · ${r.stage}`}; }),
      existingNote:'Deals that already have a contact aren’t listed — a deal has one contact.',
      fields:objectFormProperties(dealData, 'deals').filter(p => p.onCreate), optionsFor:dealFormOptions(dealData), adjust:dealFormAdjust(dealData)}] : []),
    ...(customers && creatable.includes('customers') ? [{object:'customers', noun:'customer', existingOnly:true,
      existing:customers.filter(c => !hasContact(c)).map(c => ({value:c.id, label:c.email ? `${c.name} · ${c.email}` : c.name})),
      existingNote:'Customers that already have a contact aren’t listed — a customer has one contact.'}] : []),
  ];

  const persist = (id, patch) => setViews(vs => vs.map(v => v.id===id ? {...v, ...patch} : v));

  const saveAsCopy = (name) => {
    const newId = 'v' + Date.now();
    setViews(vs => [...vs, makeView(newId, name, {columnOrder, sort, viewMode, pipelineId, search, filters, frozenLeft, frozenRight, actionsFrozen, rowsPerPage, cardSettings})]);
    setActiveViewId(newId);
    setShowSaveAsCopy(false);
  };
  const confirmSaveExisting = () => { persist(activeView.id, {columnOrder, sort, viewMode, pipelineId, search, filters, frozenLeft, frozenRight, actionsFrozen, rowsPerPage, cardSettings}); setConfirmOverwrite(false); };

  const visibleViews = views.filter(v=>!v.hidden);
  /* Violations: the same button and list as Deals and Customers. Workflows don't run on Contacts
     yet, so no workflow applies and the button stays hidden. */
  const engineCtx = useWorkflowEngineCtx();
  /* Bulk Actions (bulkActions.jsx): edit as updateContact does (owner history too); delete as the
     contact's Delete does (its activity goes; its deals and customers stay, unlinked); the Board's
     stage moves in one change, as a card dragged between stages is written. */
  const {bulkActions:contactBulkActions, board:contactBoardBulk, bulkModal:contactBulkModal} = useRecordBulk({object:'contacts', data:dealData, records:contacts,
    update:(ids, patch) => ids.forEach(id => updateContact(id, patch)),
    move:(ids, fn) => setContacts(cs => cs.map(c => ids.includes(c.id) ? fn(c) : c)),
    remove:(ids) => {
      setContacts(cs => cs.filter(c => !ids.includes(c.id)));
      setActivities(m => { const n = {...m}; ids.forEach(id => delete n[id]); return n; });
      ids.forEach(id => onRecordDeleted && onRecordDeleted('contacts', id));
      if(detail && ids.includes(detail.id)) setDetail(null);
    }});
  const contactViolationMode = !!engineCtx && engineCtx.violationMode === 'contacts';
  const setContactViolationMode = (on) => engineCtx && engineCtx.setViolationMode(on ? 'contacts' : false);

  return (
    <RecordSchema.Provider value={{...objectSchema, bulkActions:contactBulkActions}}>
    <div style={{flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden', position:'relative'}}>
      <RecordToolbar inset="page" views={visibleViews} activeViewId={activeViewId} onSelectView={setActiveViewId}
        viewControls={<>
          <ViewSettingsButton onClick={()=>setAllViewsOpen(true)}/>
          <SaveViewMenu dirty={dirty} onSaveCopy={()=>setShowSaveAsCopy(true)} onSaveExisting={()=>setConfirmOverwrite(true)}/>
        </>}
        controls={<>
          {/* The pipeline a Board is grouped by: only in Board mode, beside the switcher. */}
          {viewMode === 'board' && <PipelineSelector pipelineId={pipelineId} onChange={setPipelineId}/>}
          <TableBoardSwitch mode={viewMode} onChange={setViewMode}/>
          <button onClick={()=>exportViewCsv({schema:objectSchema, rows:filteredContacts, columnOrder, search, sort, fileName:activeView.name})} style={toolbarButton}><Icon name="export" size={13} color={T.gray600}/> Export</button>
          <button onClick={()=>setContactForm({mode:'add', initial:null})} title="Add contact" style={toolbarIconButton}>
            <Icon name="plus" size={14} color={T.gray800}/>
          </button>
        </>}
        search={search} onSearch={setSearch} filters={filters} setFilters={setFilters} appliedFilterCount={appliedFilterCount}
        filterControls={<ViolationsButton object="contacts" pipelines={[pipelineId]} active={contactViolationMode} onClick={()=>setContactViolationMode(!contactViolationMode)}/>}/>

      {/* The records, with the Violations list over them (as on Deals and Customers). */}
      <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column', position:'relative', overflow:'hidden'}}>
      {contactViolationMode && <ViolationPanel object="contacts" pipelines={[pipelineId]} onClose={()=>setContactViolationMode(false)}/>}
      {viewMode === 'table' ? (
        <ContactsDataGrid rows={filteredContacts} resetKey={`${activeViewId}:${JSON.stringify(filters)}`} columnOrder={columnOrder} setColumnOrder={setColumnOrder}
          frozenLeft={frozenLeft} frozenRight={frozenRight} actionsFrozen={actionsFrozen} rowsPerPage={rowsPerPage}
          sort={sort} setSort={setSort} search={search}
          actions={tableRowActions} onOpenContact={openContact}/>
      ) : (
        /* Board gets the same filtered rows and the same search box as the table; only the
           grouping and the presentation differ. Dragging a card writes the stage back through
           the pipeline model, which for a property-based pipeline means updating the property. */
        <ContactBoard rows={filteredContacts} search={search} pipelineId={pipelineId} bulk={contactBoardBulk(pipelineById(pipelineId))}
          onChangeStage={(contactId, stageId)=>{
            // Records → Edit → Move between pipeline stages.
            const c0 = contacts.find(c => c.id === contactId);
            if(c0 && !stageMoveCan('contacts', c0)) return hub && hub.toast("You can't move this contact between stages");
            setContacts(cs => cs.map(c => c.id===contactId ? withStage(pipelineById(pipelineId), c, stageId) : c));
          }}
          actions={tableRowActions} activities={shownActivities} onOpenContact={openContact}
          cardSettings={cardSettings} cardProperties={cardProperties}
          /* A column's + seeds the form with that stage via the pipeline model, so a manual
             pipeline would seed its own stage field the same way. */
          onAddToStage={(pipeline, stageId)=>setContactForm({mode:'add', initial:withStage(pipeline, {}, stageId)})}/>
      )}
      </div>

      {allViewsOpen && (
        <ViewSettingsDrawer views={views} activeViewId={activeViewId} setActiveViewId={setActiveViewId}
          onClose={()=>setAllViewsOpen(false)}
          onReorder={(from,to)=>setViews(vs=>{ const next=vs.slice(); const [m]=next.splice(from,1); next.splice(to,0,m); return next; })}
          onToggleHide={(id)=>persist(id, {hidden: !views.find(v=>v.id===id).hidden})}
          // A clone copies the whole view: columns, freezes, rows per page, sort, search, filters, its board and pipeline.
          onClone={(id)=>{ const {id:_id, name, isDefault, hidden, ...rest} = views.find(x=>x.id===id); setViews(vs=>[...vs, makeView('v'+Date.now(), `${name} copy`, JSON.parse(JSON.stringify(rest)))]); }}
          onDelete={(id)=>setDeletingView(id)}
          onRename={(id,name)=>persist(id, {name})}
          onPatchView={(id,patch)=>{ persist(id, patch); if(id===activeViewId){
            if(patch.viewMode!==undefined) setViewMode(patch.viewMode);
            if(patch.rowsPerPage!==undefined) setRowsPerPage(patch.rowsPerPage);
          }}}
          // The chosen view's own table settings (the open view's as they stand).
          onOpenTableSettings={(id)=>{ const v = views.find(x=>x.id===id) || {}; setTableSettingsDraft(id === activeViewId ? {columnOrder, frozenLeft, frozenRight, actionsFrozen}
            : {columnOrder:v.columnOrder || columnOrder, frozenLeft:v.frozenLeft ?? 0, frozenRight:v.frozenRight ?? 0, actionsFrozen:v.actionsFrozen ?? true}); setActiveViewId(id); }}
          onOpenCardSettings={(id)=>{ setActiveViewId(id); setCardSettingsDraft(JSON.parse(JSON.stringify(id === activeViewId ? cardSettings : (views.find(v=>v.id===id).cardSettings || DEFAULT_CARD_SETTINGS())))); }}
          liveViewMode={viewMode} livePipelineId={pipelineId}/>
      )}

      {/* Deleting a saved view: asked first. With none left, the default view comes back. */}
      {deletingView && (() => { const v = views.find(x => x.id === deletingView);
        return v ? <StModal title="Delete View" primary="Delete View" danger onCancel={()=>setDeletingView(null)}
          onSubmit={()=>{ const next = views.filter(x => x.id !== v.id), finalViews = next.length ? next : [makeView('v1', 'All contacts', {isDefault:true})];
            setViews(finalViews); if(activeViewId === v.id) setActiveViewId(finalViews[0].id); setDeletingView(null); }}>
          <div style={{fontSize:13, color:T.attioText, lineHeight:1.5}}>"{v.name}" will be deleted.</div>
        </StModal> : null; })()}

      {tableSettingsDraft && (
        <TableSettingsModal draft={tableSettingsDraft} setDraft={setTableSettingsDraft}
          onClose={()=>setTableSettingsDraft(null)}
          onApply={()=>{
            setColumnOrder(tableSettingsDraft.columnOrder);
            setFrozenLeft(tableSettingsDraft.frozenLeft);
            setFrozenRight(tableSettingsDraft.frozenRight);
            setActionsFrozen(tableSettingsDraft.actionsFrozen);
            setTableSettingsDraft(null);
          }}/>
      )}

      {panelSettingsDraft && (() => {
        const pc = detail && contacts.find(x => x.id === detail.id);
        return <PanelSettingsModal kind={panelKind} draft={panelSettingsDraft} setDraft={setPanelSettingsDraft}
          sample={pc ? {contact:pc, acts:visibleActivities('contacts', pc, activities[pc.id])} : null}
          onClose={()=>setPanelSettingsDraft(null)}
          onApply={()=>{ setPanelSettings(panelSettingsDraft); setPanelSettingsDraft(null); }}/>;
      })()}
      {cardSettingsDraft && (
        <CardSettingsModal draft={cardSettingsDraft} setDraft={setCardSettingsDraft}
          properties={cardProperties}
          sample={(() => {
            /* A board contact that exercises most of the card (temperature, deals, owner). */
            const c = filteredContacts.find(x => x.temperature === 'Hot' && x.dealCount > 0 && x.owner) || filteredContacts[0] || contacts[0];
            return c ? {contact:c, acts:visibleActivities('contacts', c, activities[c.id])} : null;
          })()}
          onClose={()=>setCardSettingsDraft(null)}
          onApply={()=>{ setCardSettings(cardSettingsDraft); setCardSettingsDraft(null); }}/>
      )}

      {contactForm && (
        <ContactFormModal mode={contactForm.mode} initial={contactForm.initial} properties={contactProperties}
          canEditField={contactForm.mode === 'edit' ? (p)=>fieldEditCan('contacts', contactForm.initial, p) : undefined}
          owners={ownerChoices} stages={CONTACT_TYPE_STAGES.map(st=>st.value)} association={association}
          onCancel={()=>setContactForm(null)} onSave={saveContact}/>
      )}
      {contactBulkModal}
      {pendingDelete && (
        <DeleteConfirmModal contactName={pendingDelete.name} paid={recordHasPayments('contacts', pendingDelete.id)}
          note={associatedNote([['deal', 'deals', dealsFor ? dealsFor(pendingDelete.id).length : 0], ['customer', 'customers', customersFor ? customersFor(pendingDelete.id).length : 0]], 'contact')}
          onCancel={()=>setPendingDelete(null)}
          onConfirm={()=>{
            const id = pendingDelete.id;
            setContacts(cs=>cs.filter(c=>c.id!==id));
            setActivities(m=>{ const n={...m}; delete n[id]; return n; });
            // Its deals and customers stay, unlinked from it.
            onRecordDeleted && onRecordDeleted('contacts', id);
            if(detail && detail.id === id) setDetail(null);
            setPendingDelete(null);
          }}/>
      )}
      {changingOwner && <ChangeOwnerModal record={changingOwner} noun="Contact" users={users.filter(u => u.status === 'Activated')} ownerName={userLabel}
        onClose={()=>setChangingOwner(null)} onSave={(owner)=>{ updateContact(changingOwner.id, {owner}); setChangingOwner(null); }}/>}
      {/* Enrich contact is listed as an action, but what it does is not defined yet. */}
      {enrichFor && <StubPanel title="Enrich contact" onClose={()=>setEnrichFor(null)}/>}
{(() => {
        const dc = detail && contacts.find(x => x.id === detail.id);
        if(!dc) return null;
        // What the acting user may see: tool activity by their permissions on this contact (and on each deal).
        const common = {contact:dc, acts:visibleActivities('contacts', dc, activities[dc.id]), properties:objectSchema.properties, panelProperties:panelKind.properties,
                        onStub:setActivityStub, onCopied:showToast};
        // Contact activity: the contact's own; Deal activity: its deals' (each with its deal).
        const activityViews = dealData ? {
          store:{state:activityViewState, setState:setActivityViewState},
          sources:{own:activityFilterRows([{acts:common.acts, contact:dc}], dealData)},
          schemaFor:(tabId) => activityFilterSchema(tabId, dealData),
        } : null;
        return <RecordAccessCtx.Provider value={{object:'contacts', record:dc}}><ContactDetail key={dc.id} {...common} mode={detail.mode} actions={tableRowActions} activityViews={activityViews}
          profiles={profiles[dc.id]} requestedTab={detail.tab}
          team={ownerOptions} onUpdateActivity={updateActivity} onAddActivity={addActivity}
          onReassignOwner={(id, owner)=>updateContact(id, {owner})}
          panelSettings={panelSettings} onOpenPanelSettings={()=>setPanelSettingsDraft(JSON.parse(JSON.stringify(panelSettings)))}
          onClose={()=>setDetail(null)}
          onExpand={()=>setDetail({id:dc.id, mode:'full'})}
          onCollapse={()=>setDetail({id:dc.id, mode:'panel'})}/></RecordAccessCtx.Provider>;
      })()}
      {activityStub && <StubPanel title={activityStub} onClose={()=>setActivityStub(null)}/>}

      {(() => {
        const cc = callFor != null && contacts.find(x => x.id === callFor);
        if(!cc) return null;
        return <CallPanel contact={cc} onEnded={(rec)=>endCall(cc.id, rec)} onClose={()=>setCallFor(null)}
          onRunProfile={(call)=>{ setCallFor(null); setProfileRun({contactId:cc.id, call}); }}/>;
      })()}
      {(() => {
        const rc = profileRun && contacts.find(x => x.id === profileRun.contactId);
        if(!rc) return null;
        return <ProfileFormFill contact={rc} call={profileRun.call} formId={(profileRun.templateIds || [])[0]}
          onCancel={()=>setProfileRun(null)} onSave={(summary)=>saveProfileRun(rc.id, summary)}/>;
      })()}
      {creatingDeal && dealData && (
        <CreateDealModal contact={creatingDeal} data={dealData} onCancel={()=>setCreatingDeal(null)}
          onSave={(vals)=>{
            const c = creatingDeal, deal = onCreateDeal(c, vals);
            const mode = detail && detail.mode === 'full' ? 'full' : 'panel';
            setCreatingDeal(null);
            showToast(`Deal created · ${deal.name}`, {label:'Open deal', onClick:()=>{ setToast(null); onOpenDeal && onOpenDeal(deal.id, mode); }});
            // One Customer Profile per person: offered now if the contact has none.
            if(!Object.keys(profiles[c.id] || {}).length) setProfilePrompt(c);
          }}/>
      )}
      {profilePrompt && (
        <ProfilePromptModal contact={profilePrompt} onCancel={()=>setProfilePrompt(null)}
          onCreate={()=>{
            const c = profilePrompt;
            const lastCall = (activities[c.id] || []).find(a => a.type === 'call' && ((a.transcript && a.transcript.length) || a.notes));
            setProfilePrompt(null);
            setProfileRun({contactId:c.id, call: lastCall ? {id:lastCall.id, segments:lastCall.transcript || [], notes:lastCall.notes || '', startedAt:lastCall.at} : null});
          }}/>
      )}
      <CopyToast message={toast && toast.message} action={toast && toast.action}/>

      {confirmOverwrite && <ConfirmOverwriteModal viewName={activeView.name} isDefault={!!activeView.isDefault} onCancel={()=>setConfirmOverwrite(false)} onConfirm={confirmSaveExisting}/>}
      {showSaveAsCopy && <SaveAsCopyModal defaultName={`${activeView.name} copy`} onCancel={()=>setShowSaveAsCopy(false)} onConfirm={saveAsCopy}/>}
    </div>
    </RecordSchema.Provider>
  );
}

Object.assign(window, {exportViewCsv, gridRowsOf, withScopeFilters, recordScopeFilterProps, newContactRecord, contactView, ownerUserOptions, assocFilterSchema, withAssocRecords, withAssocFilters, RecordToolbar, TableBoardSwitch, toolbarButton, toolbarIconButton, ContactsModule, RecordSchema, useRecordSchema, ContactsDataGrid, Pagination, SaveViewMenu, FilterModal,
  TableSettingsModal, ViewSettingsDrawer, ConfirmOverwriteModal, SaveAsCopyModal, applyFilters, countAppliedFilters, EMPTY_FILTERS});
