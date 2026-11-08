# Dựng lại Splitune quanh một vòng lặp tập

Bản thiết kế lại nên bắt đầu từ hành vi tập, không từ bảng màu. Bằng chứng mạnh nhất về luyện tập cho thấy người tập giỏi khác người tập kém ở chiến lược (tìm đúng ô nhịp lỗi, lặp tới khi ổn định, đổi tốc độ có chủ đích), không ở số giờ. Vì thế mọi màn hình của Splitune phải rút ngắn một vòng lặp duy nhất: nhảy tới ô nhịp, lặp, đổi tốc độ, tự chấm lượt, mà tay không rời cây đàn. Moises, Capo, Soundslice và Songsterr đã hội tụ về dark mode, chữ hợp âm lớn và "ký hiệu là dòng thời gian", nên đó chỉ là mức sàn. Khoảng trống thật nằm ở hai chỗ chưa ai làm tốt: lúc chờ xử lý nhiều phút và lúc sửa kết quả AI. Về hình ảnh, báo cáo đề xuất hướng A "Night Rehearsal" (graphite ấm, ký hiệu mực sáng trên nền tối, một màu amber duy nhất cho "bây giờ") làm mặc định thương hiệu, kèm theme "Daylight" sinh từ cùng bộ token. Cần nói thẳng: ghi chú nghiên cứu hình ảnh nghiêng về nền giấy sáng để đọc trên giá nhạc ban ngày, và hướng đó gần với "Music Stand" hiện tại mà bạn muốn rời bỏ. Vì vậy một bài thử đọc trên giá nhạc thật (A, Daylight và B ở 0,5 / 0,75 / 1,5 m) là cổng bắt buộc trước khi viết code. Về cấu trúc, app chuyển sang shell thanh trên với ⌘K và nút "Add song" toàn cục. Bài hát mở thẳng vào Practice rồi đầy dần theo từng stage. Màn hình Practice gồm song map, cột "Now", canvas ký hiệu, inspector bốn tab (Loop / Mix / Progress / Fix) và transport dock. Kế hoạch tám giai đoạn (0–7) tách phần re-skin thuần (token, chữ, component, bố cục) khỏi phần phạm vi sản phẩm mới, nơi tập trung phần lớn rủi ro: speed ladder (V1), sections (V3), visual metronome (V9), mixer nhiều stem, hai tab Fix và Progress, thông báo Web Push, và Stand view lật trang theo audio. Chỉ số thành công nên là tốc độ của lượt sạch đầu tiên ở buổi tập kế tiếp, không phải số phút hay streak.

## Người tập giỏi thắng nhờ chiến lược, nên giao diện phải rút ngắn đúng một vòng lặp

Câu hỏi thiết kế đầu tiên không phải Splitune nên trông thế nào, mà là người học cần làm việc gì nhanh hơn, và ở đây bằng chứng khá nhất quán. Một meta-analysis 88 nghiên cứu cho thấy **deliberate practice giải thích khoảng 21 % phương sai thành tích âm nhạc** (r ≈ 0,46), so với 4 % trong giáo dục và dưới 1 % trong nghề nghiệp ([Macnamara, Hambrick & Oswald 2014](https://stafforini.com/works/macnamara-2014-deliberate-practice-and/)). Một meta-analysis chỉ riêng âm nhạc ra hệ số hiệu chỉnh rc = 0,61, nên tỷ lệ thật vẫn còn tranh cãi, đâu đó từ một phần năm tới một phần ba ([Platz và cộng sự 2014](https://www.frontiersin.org/articles/10.3389/fpsyg.2014.00646/pdf)). Phần quyết định nằm ở cách tập. Duke, Simmons & Cash cho 17 sinh viên piano tập một đoạn Shostakovich dài ba ô nhịp rồi kiểm tra hôm sau, và thấy **chiến lược, chứ không phải thời lượng, dự báo kết quả** ([JRME 2009](https://journals.sagepub.com/doi/10.1177/0022429408328851)). Nhóm giỏi không mắc ít lỗi hơn lúc đầu mà xử lý lỗi khác: chậm lại ngay trước chỗ từng sai mà không dừng, rồi lặp đoạn đích tới khi lỗi biến mất và giữ ổn định qua các lượt sau. Nhóm này trung bình chỉ có **3 lượt sai, so với 13,56 lượt** ở nhóm kém ([bản sao không chính thức, cần đối chiếu tạp chí](https://www.scribd.com/document/494219936/DukeEtAl2)). Quan sát 60 học sinh chơi kèn của Miksza cùng chiều: lặp đoạn, whole-part-whole, chơi chậm và nhảy thẳng tới (hoặc ngay trước) đoạn khó là những hành vi tương quan với thành tích ([Miksza, JRME](https://www.sciencegate.app/document/10.1177/0022429408317513)).

Gộp lại, các hành vi có bằng chứng tốt đều quy về một thao tác: **nhảy tới đúng ô nhịp và lặp nó ở tốc độ chỉnh được, với chi phí thiết lập gần bằng không.** "Nhảy thẳng tới đoạn khó" thực chất là một yêu cầu về tốc độ điều hướng, nên bản thiết kế lại cần một thước đo cứng: từ trạng thái đang phát, tạo được loop quanh ô nhịp hiện tại trong tối đa hai thao tác (chạm, phím hoặc bàn đạp), trung vị dưới 3 giây và không cần kéo.

Phần bằng chứng yếu cũng quan trọng không kém, vì nó cho biết cái gì không được đóng cứng. Thí nghiệm 60 học sinh của Henley thấy **cách tăng tốc (tăng dần, giữ nguyên hay xen kẽ) không có tác động đáng kể**, trong khi được nghe mẫu thì có tác động ([Henley 2001](https://journals.sagepub.com/doi/10.2307/3345799)). Tập với metronome ở 60 BPM không hơn các chiến lược khác ([Hanberry 2004](https://repository.lsu.edu/gradschool_dissertations/1187/)); ngược lại, tắt metronome vài phách mới làm lộ độ ổn định nhịp bên trong người chơi ([Owens & Cunningham](https://wrexham.repository.guildhe.ac.uk/id/eprint/17318/1/More%20Cowbell_Variations_inc%20c%20sheet.pdf)). Ở 50 sinh viên trumpet, chỉ điều kiện kết hợp tưởng tượng, hát và chơi cải thiện được biểu cảm ([Steenstrup và cộng sự 2021](https://www.frontiersin.org/articles/10.3389/fpsyg.2021.757052/full)). Theo một báo cáo thứ cấp, chơi cùng backing chất lượng tốt chủ yếu giúp người chơi gắn bó cảm xúc với bản nhạc ([Music Teacher](https://musicteachermagazine.co.uk/content/feature/backing-tracks-good-or-bad)). Hệ quả cho thiết kế là speed ladder phải là một mặc định chỉnh được, không được quảng cáo như "khoa học": bắt đầu từ tốc độ sạch tốt nhất (hoặc 70 % nếu chưa có), tăng 5 % sau 3 lượt sạch, giảm 5 % sau 2 lượt hỏng. Ba thứ còn lại là tùy chọn có đo lường, không phải luật: "gap click" tắt click vài ô nhịp; lượt "listen first" chỉ nghe part đã tách trước khi chơi; và gợi ý chuyển từ "Your part loud" sang "Minus-one" khi loop đã sạch ở từ 90 % tốc độ gốc trở lên.

Điểm có sức nặng nhất cho chỉ số sản phẩm đến từ trí nhớ dài hạn. Trong nghiên cứu 10 nghệ sĩ clarinet của Carter & Grahn, **bài kỹ thuật tập theo khối bị giảm điểm từ ngày 1 sang ngày 2**. Tập xen kẽ cho điểm trung bình cao hơn nhưng không đạt ý nghĩa thống kê, và người tham gia chia đôi ý kiến: sáu người thấy xen kẽ hữu ích hơn, sáu người vẫn thích tập khối ([Carter & Grahn 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC4989027/)). Thí nghiệm 29 nhạc công học một chuỗi phím của Simmons gợi ý giấc ngủ củng cố độ chính xác ([Simmons 2011](https://www.bohrium.com/paper-details/distributed-practice-and-procedural-memory-consolidation-in-musicians-skill-learning/813362932149649409-5172)). Vì vậy **độ trôi chảy trong buổi tập là thước đo đánh lừa.** Thước đo trung thực là tốc độ của lượt sạch đầu tiên ở buổi kế tiếp. Splitune đã lưu best clean tempo cho từng clip; bản thiết kế lại nên nâng "first clean pass next session" lên thành chỉ số giữ chân chính, và mở buổi tập đầu tiên sau một đêm bằng gợi ý "Warm up with yesterday's hard bars".

### Nhật ký tự động và phản hồi về năng lực thay cho streak

Tự báo cáo về việc tập không đáng tin: khác biệt giữa các nhóm trong tự báo cáo nhiều lần mâu thuẫn với hành vi quan sát được ([Holmes-Davis 2015](https://open.bu.edu/items/6a4e02ef-3c43-4cdc-b1a3-d446f5491900)). Vì vậy log phải tự động ghi loop nào, ở tốc độ nào và lượt nào được chấm "Felt clean", còn phần tự nhìn lại chỉ tốn một chạm. Streak tạo sự đều đặn nhưng gây bực bội khi mất chuỗi ([nghiên cứu về Duolingo, n = 7](https://eprints.umpo.ac.id/21371/)). Lý thuyết tự quyết (self-determination) cho rằng phần thưởng bên ngoài làm xói mòn động lực nội tại ([Evans 2015](https://selfdeterminationtheory.org/wp-content/uploads/2021/05/2015_Evans_SDT_MusicEdu.pdf)), và tổng quan về gamification thấy hiệu ứng phụ thuộc bối cảnh, có thể chỉ là hiệu ứng mới lạ ([Hamari và cộng sự 2014](https://www.lescahiersdelinnovation.com/wp-content/uploads/2019/06/2014-hamari_et_al-does_gamification_work.pdf)). Phía người dùng cũng ủng hộ hướng này. CEO Fender nói **90 % người mới chơi guitar bỏ đàn trong 12 tháng**; đây là con số từ khảo sát khách hàng của hãng, không phải nghiên cứu công bố ([Guitar World](https://www.guitarworld.com/news/90-percent-of-new-guitarists-abandon-the-instrument-within-a-year-according-to-fender)). Người lớn chơi nghiệp dư thì đo thành công bằng niềm vui ([AYO](https://ayo.com.au/why-am-i-doing-this-an-insight-into-the-experiences-of-adult-learners-of-musical-instruments/)). Với nhóm ít thời gian này, đòn bẩy lớn nhất là khoảng thời gian từ lúc mở app tới lượt chơi đầu tiên có tiếng. Mục tiêu hợp lý là dưới 10 giây, qua một thẻ "Continue: <song>, bars 17–20 at 75 %". Mô hình theo dõi nhẹ nhàng đã có tiền lệ: Soundslice hiện bảy vòng tròn cho bảy ngày gần nhất của mỗi bản nhạc, không XP, không nhiệm vụ ([Soundslice practice tracking](https://www.soundslice.com/help/en/player/notebook/283/practice-tracking/)). Mục tiêu ngắn hạn nên sinh từ dữ liệu ("bars 17–20 clean at 80 %") thay vì "tập 20 phút", vì người chơi giỏi tổ chức việc tập quanh những mục tiêu nhỏ và cụ thể ([MTNA 2024](https://certification.mtna.org/downloads/Informed/EJ/AOY/2024_E-Journal_AOY.pdf)).

### Một bàn đạp AirTurn mới mở hộp sẽ đổi tốc độ thay vì phát nhạc

Bàn đạp lật trang Bluetooth hoạt động như bàn phím HID, phím gửi đi phụ thuộc chế độ phần cứng, và **chế độ mặc định của AirTurn BT200S (Mode 2) gửi phím mũi tên Up/Down** ([sổ tay AirTurn BT200S](https://manualslib.com/manual/1986862/Airturn-Bt200s-Series.html?page=13)). Tài liệu nhà phát triển của AirTurn đánh số các chế độ khác lệch đi, nhưng cũng ghi Mode 2 là Up/Down ([AirDirect FAQ](https://dev.airturn.com/sdk/docs/main/airdirect-faq.html)). iRig BlueTurn cũng có chế độ Arrow Up/Down, chọn lúc bật nguồn ([trang sản phẩm](https://www.musicjunction.com.au/products/irig-blueturn-bluetooth-page-turner)). Bảng phím hiện tại của Splitune gán ↓/↑ cho chậm/nhanh 5 %. Kết quả là **ai kết nối một chiếc AirTurn để nguyên chế độ gốc sẽ đổi tốc độ trong khi tưởng mình đang phát hay lặp lại**: một lỗi hành vi rẻ để sửa nhưng đắt nếu bỏ qua. Trên web không phân biệt được bàn đạp với bàn phím, nên lời giải là một wizard hai bước "Press your left pedal… now your right" bắt bất cứ phím nào thiết bị gửi. Mặc định bàn đạp trái là Restart loop, bàn đạp phải là Play/pause, và trong lúc chưa cấu hình thì ↑/↓ không được âm thầm đổi tốc độ. Nhạc công quen forScore kỳ vọng một bảng ánh xạ chung cho phím, bàn đạp và MIDI ([forScore](https://forscore.co/?p=1641)). Nhưng **Safari ở mọi phiên bản đều không hỗ trợ Web MIDI** ([caniuse](https://caniuse.com/midi)), nên trên iPad, riêng đường bàn phím phải đủ cho mọi thao tác. Người dùng báo cử chỉ khuôn mặt bị kích hoạt nhầm khi biểu diễn ([Delcamp](https://www.classicalguitardelcamp.com/viewtopic.php?p=1687299)), nên giọng nói và khuôn mặt không nằm trên đường chính. Mọi thao tác phím hay bàn đạp phải được xác nhận trên màn hình trong khoảng 0,1 giây, ngưỡng để cảm giác tức thời ([NN/g](https://www.nngroup.com/articles/response-times-3-important-limits/)).

Cách đặt thiết bị khi tập thêm ba ràng buộc. Ràng buộc thứ nhất là khoảng cách. Hướng dẫn của hiệp hội thư viện dàn nhạc (chỉ biết qua trích dẫn trên diễn đàn) coi khuông nhạc cao 8,5 mm là dễ đọc nhất cho bè, khi bản nhạc cách mắt khoảng 3 ft ([Musica Sacra](https://forum.musicasacra.com/forum/discussion/comment/179594)). Dorico gọi 7 mm là cỡ phổ biến và ghi rằng người chơi ngồi xa giá nhạc chuộng khuông lớn hơn ([Steinberg Dorico](https://steinberg.help/dorico_first_steps/v5/en/dorico_first_steps/topics/first_steps_layout_formatting/first_steps_staff_size_changing_t.html)). Quy ra góc nhìn ≈ 0,54°, khuông phải cao khoảng **4,7 mm ở 0,5 m, 7,1 mm ở 0,75 m và 14,1 mm ở 1,5 m**. Đây là ước tính cần thử, nhưng nó đủ để kết luận rằng cỡ tab và hợp âm phải định nghĩa theo góc nhìn, không theo px. Ràng buộc thứ hai là màn hình: Screen Wake Lock có từ Safari 16.4 nhưng từng không chạy trong web app đã cài ra Home Screen ([WebKit bug 254545](https://bugs.webkit.org/show_bug.cgi?id=254545)). Vì vậy phải xin lại wake lock mỗi khi có `visibilitychange` và báo nhẹ khi không giữ được. Ràng buộc thứ ba là âm thanh. Thí nghiệm vỗ tay qua mạng thấy **độ trễ vượt khoảng 25 ms làm tempo chậm dần** ([Chafe & Gurevich 2004](https://ccrma.stanford.edu/~cc/vox/aesFinal.pdf)), trong khi Yamaha cho biết tai nghe Bluetooth thông thường trễ khoảng 200 ms ([Yamaha](https://usa.yamaha.com/products/musical_instruments/guitars_basses/amps_accessories/yh-wl500/index.html)). Thiết lập "Sound delay" hiện tại chỉ chỉnh được từ −150 tới +150 ms, **không đủ để bù một tai nghe Bluetooth điển hình.** Bản thiết kế lại cần một bước hiệu chỉnh "tap along with the click", một dải bù rộng hơn, và cảnh báo khi đầu ra có vẻ là không dây. Buổi tập dài với tai nghe còn liên quan tới chuẩn nghe an toàn WHO-ITU H.870 (với người lớn, mức tham chiếu tương đương 80 dBA trong 40 giờ mỗi tuần) ([WHO](https://www.who.int/publications/i/item/9789241515276)). Vì vậy preset "Your part loud" không được đẩy master vượt unity nếu không có limiter.

### WCAG 2.2 biến thành luật cho từng control

Màn hình tập vướng trực tiếp vào nhiều tiêu chí của WCAG 2.2. Target phải rộng ít nhất 24×24 CSS px ở mức AA ([2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)) và 44×44 ở mức AAA ([2.5.5](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)). Splitune nên lấy 44 px làm luật nội bộ và 64 px cho control chính khi tập. Transport dock dính đáy và bottom sheet không được che kín phần tử đang có focus ([2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)). Mọi thao tác kéo (tay nắm loop, fader, thanh tốc độ, vách chia) phải làm được bằng một con trỏ mà không cần kéo ([2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)). Phím tắt một ký tự như C, N, L, M phải tắt được, gán lại được, hoặc chỉ hoạt động khi vùng tập có focus ([2.1.4](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html)). Nội dung tự cuộn phải dừng được, và dừng phát nhạc thì phải dừng cuộn ([2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)). Visual metronome là chỗ dễ vi phạm nhất: **ở 180 BPM, chớp mỗi phách là đúng ba lần mỗi giây, chạm giới hạn của [2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html).** Do đó nhịp đập phải gói trong một vùng nhỏ, thể hiện bằng đổi hình hay chuyển động thay vì làm chớp cả vùng lớn. Phách mạnh được phân biệt bằng hình dạng, không bằng màu ([1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html), [1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)). Với người dùng trình đọc màn hình, đơn vị hữu ích là ô nhịp. Chưa có "talking score" nào cho tab, nên một nhóm sinh viên đã phải tự dựng bộ chuyển MusicXML sang văn bản ([UW Talking Guitar Tabs](https://courses.cs.washington.edu/courses/cse493e/24au/projects/guitar/index.html)), còn OSMD đã có plugin braille dùng với NVDA và JAWS ([OSMD Braille](https://www.netidee.at/sites/default/files/2026-07/OSMD_Braille_User_Guide.pdf)). Splitune đã có phần mô tả theo ô nhịp cho trình đọc màn hình. Nguyên tắc nên giữ là chỉ đọc khi người dùng yêu cầu, không đọc trực tiếp từng nốt trong lúc phát. Với tiến trình xử lý, một live region `polite` có sẵn trong DOM chỉ báo các mốc stage, không báo từng phần trăm ([MDN aria-live](https://developer.mozilla.org/docs/Web/Accessibility/ARIA/Attributes/aria-live)), vì cập nhật dày đặc trong live region tự nó đã là rào cản ([TMU](https://pressbooks.library.torontomu.ca/wafd/chapter/live-regions/)).

## Đối thủ đã hội tụ về bố cục; lúc chờ và lúc sửa vẫn bỏ ngỏ

### Ký hiệu là dòng thời gian, còn cách cuộn là lựa chọn của người dùng

Soundslice là tham chiếu có tài liệu tốt nhất. Nó có hai bố cục, Scrollable và Paged. Ở Paged, "mỗi khuông được bảo đảm nằm trọn trên màn hình, không cần cuộn", và player hiện hai trang khi vùng ký hiệu rộng từ 1500 px ([Soundslice: Paged layout](https://www.soundslice.com/blog/241/introducing-our-new-paged-layout/); [Scrollable vs paged](https://www.soundslice.com/help/en/player/advanced/241/scrollable-vs-paged-layout/)). Cách màn hình đi theo playhead là một chính sách người dùng tự chọn: giữ playhead ở trên, giữ ở giữa, chỉ cuộn khi cần, cố định bên trái, hoặc tắt hẳn khi sửa ([Playhead scrolling](https://www.soundslice.com/help/en/player/advanced/116/playhead-scrolling-options/)). Hình dạng playhead cũng chọn được: mặc định là một đường kẻ cam, có khối nhỏ cho ai thấy đường kẻ quá chói, và có tùy chọn tô nền ô nhịp đang phát ([Playhead style](https://www.soundslice.com/help/en/player/advanced/292/playhead-style-color/)). Focus mode dựng lại đoạn loop thành một bản nhạc độc lập trải kín màn hình, rất hợp với điện thoại ([Focus mode](https://www.soundslice.com/help/en/player/basic/277/focus-mode/)). Người dùng chuộng Songsterr vì **trường độ được vẽ bằng đuôi nốt ngay dưới khuông tab** ([GuitarChalk 2026](https://www.guitarchalk.com/full-songsterr-review/)). Các phản mẫu cũng rõ. Autoscroll của Ultimate Guitar "hoặc nhảy vụt, hoặc đứng im", và playback MIDI của nó bị chê là cứng ([UG App Store](https://apps.apple.com/us/app/ultimate-guitar-chords-tabs/id357828853)). Con trỏ của alphaTab, đúng thư viện mà pipeline alphaTex của Splitune nhắm tới, từng "nhảy quá xa rồi giật lại" khi nội suy tuyến tính ([alphaTab #318](https://github.com/CoderLine/alphaTab/issues/318)). Bài học thiết kế gồm bốn điểm. Follow mode (Page / Scroll / Off) là một setting hiện ra trên màn hình và được nhớ lại. Con trỏ chạy theo bản đồ phách–thời gian lấy từ đồng hồ audio, không ngoại suy. Tab luôn có đuôi nhịp. Nền ô nhịp hiện tại là tín hiệu định vị không phụ thuộc màu. Còn một chi tiết quan trọng cho phần hình ảnh: Soundslice **cố ý giữ ký hiệu nền sáng làm mặc định** ngay cả khi UI tối, vì nốt sáng trên nền tối "kém truyền thống" và nên do người dùng chủ động chọn ([Soundslice theme](https://www.soundslice.com/help/en/player/advanced/301/theme/)).

### Loop, tốc độ, mixer và hợp âm: các mẫu tốt nhất đã có tài liệu

Capo có mô hình transport chi tiết nhất. Region mới phủ đúng ô nhịp hiện tại và mặc định bắt dính vào phách. Khi đã chọn region, nút Play chuyển sang lặp, không cần công tắc loop riêng. Count-in tính bằng **ô nhịp (Off / 1 / 2 / 4)**, phát trước khi loop bắt đầu ([Capo: advanced playback](https://supermegaultragroovy.com/products/capo/help/ios/4.5/advanced-audio-playback/)). Thanh tốc độ hiện phần trăm cùng tempo tương ứng, dải 25–150 %, với nút bước 1 % ở hai đầu. Key (dịch theo nửa cung, hợp âm đổi theo) tách riêng khỏi Pitch (±100 cent, dùng cho bản thu lệch chuẩn). Một Control Strip duy nhất chuyển qua lại giữa các bộ control, và biểu tượng của bộ nào sáng lên khi bộ đó đang làm thay đổi playback; chẳng hạn biểu tượng Mixer sáng khi có kênh dưới 100 % ([Capo: control strip](https://supermegaultragroovy.com/products/capo/help/ios/4.5/control-strip/)). Mixer của Capo coi bài hát, hợp âm synth và metronome đều là kênh ([Capo](https://supermegaultragroovy.com/products/capo/help/ios/4.5/advanced-audio-playback/)). Chordify tách "chord volume" khỏi "song volume" ([GuitarChalk](https://www.guitarchalk.com/chordify-review/)), và BandLab dùng chữ M/S cho từng stem ([BandLab](https://help.bandlab.com/hc/en-us/articles/16560236938777-What-is-Splitter)). Speed trainer đã có bộ tham số mẫu: Soundslice cho đặt tốc độ đầu, tốc độ cuối, bước tăng và số lượt mỗi bước (ví dụ 50→100 %, bước 10 %, mỗi bước 4 lượt, tổng 24 lượt). Soundslice tự nhận trainer không giảm được tốc độ và không lưu được preset ([Soundslice speed training](https://www.soundslice.com/help/en/player/basic/286/speed-training/)), hai chỗ Splitune có thể làm tốt hơn. Nút "dời loop đúng bằng độ dài của nó" của Music Speed Changer ghép tự nhiên với nút "×2 độ dài" ([Music Speed Changer](https://help.musicspeedchanger.com/article/fb34fxvon7-a-b-practice-loop-points)).

Ở phần hợp âm, Chord Chooser của Capo liệt kê các phương án thay thế xếp theo khả năng, cho nghe thử voicing và có "Replace all" ([Capo: analysis](https://supermegaultragroovy.com/products/capo/help/ios/4.5/automatic-music-analysis/)). Bố cục Grid-Aligned của Capo giữ độ rộng ô cố định ([Capo: project view](https://supermegaultragroovy.com/products/capo/help/ios/4.5/project-view/)), ngược hẳn với lời than về Chord AI: "lúc 1 phách một ô, lúc 2 phách một ô" ([Chord AI App Store](https://apps.apple.com/us/app/chord-ai-play-any-song/id1446177109)). Chordify nhớ capo, transpose và simplify riêng cho từng bài ([APKMirror](https://www.apkmirror.com/apk/chordify-b-v/chordify/chordify-1755-release/)). Những điều không được làm cũng có tài liệu: Capo không lưu chỉnh sửa nếu người dùng không đăng ký ([Capo App Store](https://apps.apple.com/dk/app/capo/id696977615)), còn Moises giới hạn count-in miễn phí ở 4 click đầu bài ([Moises help](https://help.moises.ai/hc/en-us/articles/6580752102044-How-do-I-set-up-the-count-in)). Splitune không bao giờ khóa loop, count-in, tốc độ hay việc lưu chỉnh sửa sau paywall.

### Chưa đối thủ nào công bố một trạng thái chờ tử tế

Không sản phẩm nào trong khảo sát mô tả công khai một màn hình chờ xử lý giàu thông tin. Mẫu quan sát được là một spinner, sau đó là kết quả trọn gói. Songsterr AI xử lý trong **5–15 phút và gửi email khi xong**, kèm bản xem trước miễn phí 20 giây ([Songsterr help](https://www.songsterr.com/help)). LALAL.AI cho nghe thử trước khi bấm "Split in Full" ([LALAL.AI FAQ](https://lalal.ai/guides/faq)), và Moises cho đổi kiểu tách stem mà không phải tải lại ([Moises web player](https://moises.ai/newsroom/product-announcements/new-moises-web-player)).

Nghiên cứu về chờ đợi thì rõ ràng. Lúc chờ quá 10 giây cần chỉ báo phần trăm kèm lý do và một ước tính thời gian thô, có đệm. Người được xem thanh tiến trình chuyển động **sẵn lòng chờ lâu hơn khoảng 3 lần**, và thanh tiến trình chững lại gần 100 % gây bực bội ([NN/g](https://www.nngroup.com/articles/progress-indicators/)). Thanh chậm lúc đầu rồi tăng tốc về cuối được ưa hơn ([Harrison và cộng sự](https://www.chrisharrison.net/index.php/Research/ProgressBars)). Buell & Norton cho thấy người dùng đôi khi thích chờ lâu hơn nếu được thấy công việc đang diễn ra ([labor illusion](https://academicnewsletter.sufe.edu.cn/info/394153)). Bray lưu ý rằng minh bạch thật cũng làm lộ thời gian chết ([Bray](https://www.kellogg.northwestern.edu/faculty/bray/doc/transparency/transparency.pdf)), và với Splitune thời gian chết chính là trạng thái "Processing machine offline" khi máy Mac của chủ app đang ngủ.

Pipeline nhiều stage của Splitune là một cơ hội hiếm: mỗi stage xong đều có một thành phẩm thật để cho người dùng thấy, và người dùng có thể tập trên audio gốc trước khi tách stem xong. Songsterr đã có AI tab, nên **khác biệt của Splitune phải đến từ trải nghiệm tập trên chính audio của người dùng** (stem thật, loop trên bản thu, độ tin cậy hiển thị rõ, điều khiển bằng bàn đạp), không phải từ việc chuyển audio thành tab ([BassBuzz](https://forum.bassbuzz.com/t/new-songsterr-ai-is-impressive/70519)). Thông báo khi xử lý xong là khả thi nhưng có điều kiện: trên iOS, Web Push chỉ dùng được cho web app đã cài ra Home Screen, và chỉ được xin quyền ngay sau một thao tác trực tiếp của người dùng ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).

### Gắn cờ thứ người học cần sửa, và nói bằng tần suất

Hướng dẫn trong ngành thống nhất ở hai điểm. Chỉ hiện độ tin cậy khi nó đã được hiệu chỉnh và làm thay đổi hành động của người dùng, và nên dùng vài nhóm ngữ nghĩa hoặc danh sách phương án thay cho con số ([Google PAIR](https://pair.withgoogle.com/chapter/explainability-trust/)). Apple nói thẳng: nếu không chắc độ tin cậy tương ứng với chất lượng kết quả thì đừng hiển thị nó ([Apple HIG](https://developer.apple.com/design/human-interface-guidelines/machine-learning)). Bằng chứng chuyển giao trực tiếp nhất đến từ một nghiên cứu đăng ký trước với 30 lập trình viên: **tô sáng các token có xác suất thấp nhất không giúp gì**, còn tô các token được dự đoán là sẽ bị sửa thì khiến người dùng sửa nhiều hơn và thấy hữu ích hơn ([Vasconcelos và cộng sự](https://arxiv.org/abs/2302.07248v3)). Hiển thị độ tin cậy giúp người dùng tin đúng mức, nhưng không tự làm tăng độ chính xác chung ([Zhang, Liao & Bellamy](https://arxiv.org/abs/2001.02114v1)). Muốn tăng độ chính xác, người dùng phải có hiểu biết bổ sung cho máy, và với người học nhạc thì đó là đôi tai. Vì vậy dấu "?" nên mời họ nghe lại đoạn đó ở tốc độ chậm. Con người hiểu sự bất định trực giác hơn khi nó được nói theo tần suất ("1 trên 10") thay vì phần trăm ([Padilla, Kay & Hullman, qua slide bài giảng](https://faculty.cs.niu.edu/~dakoop/cs628-2021fa/lectures/lecture15.pdf)), khớp với câu chữ sẵn có "Second guess · about 1 in 3".

Công cụ chuyên nghiệp cho sẵn mô hình sửa lỗi. Melodyne tách việc "sửa kết quả phân tích" (không đổi âm thanh, phương án bị loại hiện thành viền rỗng) khỏi việc "sửa nhạc" ([Celemony](https://helpcenter.celemony.com/M5/doc/melodyneEditor5/en/M5tour_NA_Mode_1?env=live)). Logic cho người dùng đặt vài gợi ý (hint) về phách và nhịp đầu rồi tự tính lại phần còn lại ([Logic Smart Tempo](https://help.apple.com/logicpro/mac/10.4/en.lproj/lgcp9281e70c.html)). Retranscribe của Klangio cho sửa đầu vào rồi chạy lại các bước sau ([Klangio](https://klang.io/?p=10950)). Trong nghiên cứu kiểm chứng 18 nguyên tắc tương tác người–AI của Microsoft, "cho biết hệ thống làm tốt tới đâu" (G2) và "cho biết vì sao hệ thống làm vậy" (G11) thuộc nhóm có liên quan nhưng ít sản phẩm làm nhất ([Amershi và cộng sự 2019](https://www.microsoft.com/en-us/research/uploads/prod/2019/01/Guidelines-for-Human-AI-Interaction-camera-ready.pdf)).

Hệ ba mức hiện tại của Splitune (mực nhạt, viền đứt, dấu "?") đã đúng hướng. Phần cần thêm có bốn việc:

- hiệu chỉnh độ tin cậy riêng cho từng stage trước khi hiển thị;
- xếp cờ theo khả năng cần sửa và hậu quả với âm nhạc;
- khi gần cả ô nhịp đều không chắc thì gộp thành một cờ "shaky bar";
- viết banner fallback theo kiểu "About 1 in 4 notes may be off".

Bảng dưới gom các mẫu trên thành mức sàn và điểm khác biệt.

| Chủ đề | Mức sàn của thị trường (tham chiếu ở trên) | Splitune hôm nay | Thiết kế lại |
|---|---|---|---|
| Loop | Region bằng ô nhịp hiện tại, bắt dính vào phách, Play chuyển thành lặp (Capo); kéo ngay trên ký hiệu (Soundslice) | Chạm hai ô nhịp, popover nhập số, kéo tay nắm trên timeline | Giữ cả ba cách; thêm dời loop theo độ dài, ×2/÷2, ±1 ô nhịp, section chip |
| Tốc độ | % kèm BPM, bước 1 %, preset (Capo, Fender) | 50–100 %, bước 5 %, preset 50/70/85/100 | Speed ladder V1, dải rộng hơn, Shift để bước 1 % |
| Count-in | Tính bằng ô nhịp, trước loop (Capo) | 0–2 ô nhịp, theo lưới phách | Giữ; thêm count-in trước mỗi lượt của ladder |
| Mixer | Mỗi stem có M/S, cộng master, click và chord synth (Capo, Chordify) | Hai kênh: part của bạn và "Backing" | Mọi stem, cộng click và chord synth, preset đặt tên theo mục tiêu |
| Hợp âm | Ô rộng cố định, simplify theo mức, nhớ capo và transpose (Capo, Chord AI, Chordify) | Dải hợp âm, chord sheet, Level & capo | Cột Now, lưới cố định, nhớ theo bài |
| Độ tin cậy | Chưa thấy sản phẩm tiêu dùng nào hiện độ tin cậy cho từng mục | Ba mức, không chỉ dựa vào màu | Thêm xếp hạng theo hậu quả, tab Fix, diễn đạt bằng tần suất |
| Chờ xử lý | Spinner rồi kết quả; email khi xong (Songsterr) | Mở Practice ngay, đầy dần, ETA theo trung vị | Timeline stage có thành phẩm, "Notify me when ready" |
| Sửa | Chọn phương án xếp theo khả năng (Capo); gợi ý phách (Logic) | Editor sheet, trang Edit trên desktop | Tab Fix: hàng đợi, nghe thử trên loop, re-quantize có xem trước |

## Night Rehearsal thắng về bản sắc, nhưng giá nhạc ban ngày mới là trọng tài

Thị trường gợi ý ba điều. Thứ nhất, các DAW lớn vẫn mặc định giao diện tối, phẳng, với chrome ít màu để màu dành cho nội dung, nhưng giờ coi giao diện là một bộ tham số. Live 12 có High-Contrast, Tone (Cool / Neutral / Warm) và Dark/Light, và có thể theo chế độ sáng/tối của hệ điều hành ([CDM](https://cdm.link/ableton-live-12-everything-new/); [Audiofanzine](https://en.audiofanzine.com/general-sequencer/ableton/live-12-suite/editorial/reviews/ableton-live-12-1-review.html)). FL Studio có hai thanh Saturation và Contrast ([Image-Line](https://www.image-line.com/fl-studio-learning-content/fl-studio-online-manual/html/envsettings_themes.htm)). Linear sinh toàn bộ theme trong không gian LCH từ ba đầu vào (màu nền, accent, độ tương phản) thay vì 98 biến ([Linear](https://linear.app/now/how-we-redesigned-the-linear-ui)). Thứ hai, rải một accent khắp nơi làm hỏng khả năng định hướng: người dùng than bản FL Studio 2025 biến trình duyệt file thành "một bức tường cam" ([Image-Line forum](https://forum.image-line.com/viewtopic.php?p=2039807)). Thứ ba, bề mặt trong suốt là rủi ro thật cho thứ phải đọc từ giá nhạc: Liquid Glass của Apple bị chê khó đọc và Apple phải lùi một phần ([9to5Mac](https://9to5mac.com/2025/09/15/ios-26-officially-launches-today-but-some-developers-arent-sure-it-should/); [Infinum](https://infinum.com/blog/apples-ios-26-liquid-glass-sleek-shiny-and-questionably-accessible/)). Ngoài ra có một bài học về triển khai: Kontakt 8 bị người dùng lâu năm chê vì giao diện chuyển đổi nửa vời, phần cũ và phần mới nằm cạnh nhau ([NI community](https://community.native-instruments.com/discussion/37014/ui-ux-feedback-your-thoughts)).

| | A "Night Rehearsal" | B "Annotated Score" | C "Pedalboard" |
|---|---|---|---|
| Bề mặt | Graphite ấm tối; ký hiệu mực sáng trên nền tối | Giấy ấm, mực đen | Panel phần cứng sáng, module lớn |
| Accent | Một màu amber "signal", chỉ dùng cho now, playhead, loop và primary action | Bút chì đỏ | Cam |
| Chữ | Instrument Sans cho UI, JetBrains Mono cho số và chữ số tab | Serif cho tiêu đề lớn | Space Grotesk |
| Bằng chứng ủng hộ | Mọi màu Okabe-Ito đều đạt 3:1 trên nền tối; một accent tránh được "bức tường cam"; dark mode nằm trong số tính năng được đòi nhiều nhất (Guitar Pro); tách hẳn khỏi Music Stand | Đọc tốt nhất dưới đèn phòng và ánh sáng ban ngày (suy luận); gần với cách người học vẫn đọc bản nhạc | Nhìn lướt từ xa tốt nhất; hợp với bàn đạp; nhiều cá tính |
| Bằng chứng phản đối | Nốt sáng trên nền tối "kém truyền thống" (Soundslice); tablet bị lóa ban ngày; dễ trông giống mọi DAW và Moises | Bốn trên bảy màu Okabe-Ito không đạt 3:1 trên nền giấy; gần với Music Stand hiện tại; màu đỏ dễ bị hiểu là "lỗi" | Gây mỏi khi tập lâu; khó chứa đủ thông tin trên desktop; dễ bị xem là bắt chước Teenage Engineering |
| Vai trò trong kế hoạch | Mặc định thương hiệu, kèm Daylight bật bằng một chạm | Phương án đối chứng trong bài thử giá nhạc | Mượn ý tưởng cho Stand view |

Phải nói thẳng về cán cân bằng chứng. Ghi chú nghiên cứu hình ảnh khuyến nghị B làm hướng thương hiệu, với lập luận rằng ký hiệu, hợp âm và tab là lõi sản phẩm, còn tình huống tablet trên giá nhạc ban ngày nghiêng về nền giấy. Ghi chú đó cũng tự tính tỷ lệ tương phản theo WCAG 2 của bảng Okabe-Ito ([danh sách màu](https://malcolmbarrett.r-universe.dev/ggokabeito/doc/manual.html)). Trên nền giấy #F5F1E8, màu cam chỉ đạt 2,00, xanh da trời 2,05, vàng 1,17 và tím đỏ 2,72, nghĩa là bốn trên bảy màu trượt ngưỡng 3:1. Trên nền #121212, cả bảy màu đều đạt, thấp nhất là xanh dương với 3,61. Ứng viên B, và ở mức nhẹ hơn là Daylight, đều gần hình ảnh "trang giấy trong khung graphite" của Music Stand, thứ bạn muốn rời bỏ. Nhu cầu đọc trong phòng sáng là có thật: đã có người bán bộ theme độ sáng cao cho Live 12, dành riêng cho phòng nhiều ánh sáng ([Isotonik](https://isotonikstudios.com/product/infra-light-theme-by-deafman-skws/)). Và chưa có nghiên cứu thực nghiệm nào so sánh UI sáng với UI tối khi đọc tab từ xa, nên cả hai phía hiện đều đang suy luận.

Báo cáo vẫn đề xuất A, vì bốn lý do. Lý do đầu tiên là mục tiêu của chính bạn: một bản sắc khác hẳn Music Stand. Thứ hai, nhu cầu giao diện tối được xác nhận nhiều lần: Songsterr thêm dark mode ngay ở bản 10.0.1 ([App Store](https://apps.apple.com/us/app/songsterr-tabs-chords/id399211291)), Guitar Pro gọi dark mode là một trong những tính năng được yêu cầu nhiều nhất ([Guitar Pro](https://www.guitar-pro.com/blog/p/48507-namm-show-2025-the-prototype-of-the-new-guitar-pro-mobile-app-unveiled)), và người dùng Bitwig xin nền tối để nốt và automation nhiều màu dễ đọc hơn ([KVR](https://www.kvraudio.com/forum/viewtopic.php?p=7431998)). Thứ ba, phép tính tương phản ở trên có lợi cho nền tối khi stem được mã hóa bằng màu. Thứ tư, một accent amber duy nhất cho "bây giờ" khớp với quy ước có sẵn, vì playhead mặc định của Soundslice cũng có màu cam ([Soundslice](https://www.soundslice.com/help/en/player/advanced/292/playhead-style-color/)). Quan trọng nhất, khi cả hai theme sinh ra từ cùng một bộ tham số thì chọn mặc định là một quyết định đảo ngược được. Daylight không phải một bản thiết kế thứ hai, mà là cùng bộ token với tham số lightness khác. Dù vậy, A chỉ được khóa lại sau bài thử giá nhạc mô tả ở dưới.

### Token OKLCH sinh từ bốn tham số

Bộ token nên dùng vai trò của thang 12 bậc kiểu Radix, gồm:

- bậc 1–2 cho nền;
- bậc 3–5 cho nền component (bình thường, hover, đang chọn);
- bậc 6–8 cho viền;
- bậc 9–10 cho mảng màu đặc;
- bậc 11–12 cho chữ.

Theo Radix, bậc 11 và 12 bảo đảm đạt APCA Lc 60 và Lc 90 trên bậc 2 ([Radix Colors](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)). Toàn bộ được sinh trong OKLCH từ bốn tham số: màu nền (graphite ấm), accent (amber), độ tương phản và độ ấm. Bốn tham số đó cho ra Night, Daylight và một biến thể "More contrast". Chế độ "Stage" hiện tại trở thành một giá trị của tham số độ tương phản, không còn là một theme riêng.

Cổng kiểm duyệt vẫn là WCAG 2.2 (4,5:1 cho chữ, 3:1 cho thành phần không phải chữ). Bản nháp WCAG 3 tháng 4/2026 ghi rõ thuật toán tương phản "vẫn chưa được xác định", và APCA đã bị bỏ khỏi bản nháp từ năm 2023 ([Adrian Roselli](https://adrianroselli.com/2026/04/wcag3-contrast-as-of-april-2026.html)). Vì vậy APCA chỉ nên là công cụ hỗ trợ cho chữ mảnh trong các panel dày đặc.

Có hai hệ quả kỹ thuật dễ bị bỏ sót. Thứ nhất, Radix ghi rằng ở bậc 9, Amber cần chữ tối, nên nút chính màu amber phải dùng chữ graphite, không dùng chữ trắng. Thứ hai, vì amber là màu dành riêng cho "bây giờ", không stem nào được nằm trong dải hue cam–vàng. Hai màu cam #E69F00 và vàng #F0E442 của Okabe-Ito phải bị loại hoặc dời hue. Bộ màu stem lấy phần còn lại của Okabe-Ito và bộ "bright" của Paul Tol, vốn an toàn cho người mù màu ([Paul Tol](https://tesselle.r-universe.dev/khroma/doc/tol.html)), với lightness riêng cho từng chế độ. Màu xanh dương phải được nâng sáng trên nền tối vì nó chỉ vừa qua ngưỡng. Stem luôn có nhãn chữ đi kèm. Lỗi và cảnh báo được thể hiện bằng hình dạng và chữ, để một stem tông đỏ không bị đọc thành lỗi.

Hạ tầng hiện có dùng lại gần như nguyên vẹn. `packages/ui-tokens/src/primitives.css` đã viết bằng OKLCH. `themes.css` đã tách tầng vai trò ngữ nghĩa khỏi tầng token component, có `data-appearance` và `data-contrast`. `contrast.test.ts` và `palette.test.ts` đã kiểm tra tương phản. Lint `scripts/check-ui-tokens.mjs` đã chặn màu raw, class palette của Tailwind và motion không lấy từ token. Phần việc là thay giá trị và mở rộng test (thêm mô phỏng mù màu cho stem ở cả hai theme), không phải đổi kiến trúc. Base UI đang ở bản 1.9.0 và vẫn là hướng chính của hệ sinh thái ([InfoQ](https://infoq.com/news/2026/02/baseui-v1-accessible/)), nên bản thiết kế lại là việc của token và style, không phải đổi thư viện.

### Chữ: Instrument Sans và JetBrains Mono là lựa chọn bản sắc, chưa có bằng chứng

Cặp Instrument Sans + JetBrains Mono không có nguồn nào trong các ghi chú nghiên cứu ủng hộ cụ thể, và báo cáo không giả vờ là có. Inter 4 đang dùng đã có tabular figures, số 0 có gạch chéo và trục optical size với các bản cắt Display ([rsms/inter](https://github.com/rsms/inter/releases)). Ghi chú nghiên cứu hình ảnh còn cho rằng một font sans với tabular figures thường đủ cho mã thời gian và đọc từ xa tốt hơn font mono. Đổi sang Instrument Sans là một quyết định thương hiệu để tách khỏi Music Stand, vì vậy nó phải qua ba phép kiểm trong giai đoạn 1: giấy phép dùng trên web, độ phủ ký tự (♯ ♭ − ·, dấu cách hẹp không ngắt) và tabular figures. JetBrains Mono cho chữ số tab có lợi là độ rộng đều và hình dáng chữ số dễ phân biệt, nhưng bất lợi là làm tab rộng ra. Font này phải được thử trên các cặp chữ số dễ nhầm 1/7, 3/8, 6/0 ở cả ba khoảng cách. Mọi con số thay đổi trong lúc phát (thời gian, bar.beat, %, BPM, dB) dùng `font-variant-numeric: tabular-nums` để không nhảy chữ. Tên hợp âm dùng ký tự ♯ ♭ thật, không dùng "#" hay "b". Phần tính chất hợp âm được thu nhỏ và nâng lên, lấy ký tự ° ø △ từ dải `csym` của SMuFL ([SMuFL chord symbols](https://smufl.formats.music/latest/tables/chord-symbols.html)). Khi ký hiệu sáng nằm trên nền tối, các nét mảnh như đuôi nốt và dòng kẻ phụ cần một font nhạc nét dày. Bravura là font SMuFL đầy đủ nhất, gần 3.000 ký tự ([SMuFL fonts](https://www.smufl.org/fonts/)), và theo ghi chú ký hiệu nhạc thì nét của nó đậm hơn Leland. Atkinson Hyperlegible Next, font đã có sẵn, tiếp tục là tùy chọn "Hyperlegible font".

### Chuyển động chỉ đi theo âm nhạc

Playhead và phần tô nốt đang phát nên nằm trên một lớp compositor riêng và di chuyển bằng `transform`. Vị trí tính từ `AudioContext.getOutputTimestamp()` trong `requestAnimationFrame` ([MDN](https://developer.mozilla.org/docs/Web/API/AudioContext/getOutputTimestamp)), có dự phòng bằng `currentTime` vì từng có báo cáo Safari trả về `contextTime` sai ([Apple Developer Forums](https://developer.apple.com/forums/thread/696356)). Khi `prefers-reduced-motion` bật, ký hiệu lật theo trang, playhead đi theo từng bước và mọi hiệu ứng fade bị bỏ. Chuyển cảnh UI (sheet, chọn, gắn panel) giữ trong khoảng 150–250 ms với thời lượng lấy từ token. Không dùng lớp trong suốt hay hiệu ứng kính phủ lên waveform hoặc ký hiệu. Không có hiệu ứng nhấp nháy trang trí theo phách, trừ khi người dùng bật visual metronome.

### Cổng giai đoạn 0: bài thử đọc trên giá nhạc thật

Bài thử này quyết định theme mặc định, không quyết định bản sắc, vì bộ token sinh được cả hai. Nên làm với chủ app và vài người chơi đàn quen, trên một prototype tĩnh của Practice dùng cùng một bài và cùng bố cục.

| Thành phần | Thiết kế bài thử |
|---|---|
| Biến thể | A "Night Rehearsal", Daylight (A ở chế độ sáng), B "Annotated Score"; cùng cỡ chữ, cùng nội dung |
| Khoảng cách và thiết bị | 0,5 m: laptop trên bàn; 0,75 m: iPad trên giá nhạc, cả dọc lẫn ngang; 1,5 m: tablet hoặc điện thoại đặt trên sàn hay ghế (trường hợp trống, bass đứng) |
| Cỡ khởi điểm (ước tính theo góc nhìn) | Hệ tab hoặc khuông ≈ 0,54°, tức khoảng 4,7 / 7,1 / 14,1 mm; chữ hoa của tên hợp âm 0,4–0,6°, tức khoảng 3,5–5,2 / 5,2–7,9 / 10,5–15,7 mm; trên iPad, 7,1 mm vào khoảng 37 CSS px |
| Ánh sáng | Ban ngày cạnh cửa sổ (có lóa), đèn phòng buổi tối, phòng gần tối |
| Nhiệm vụ | Vừa chơi vừa đọc hợp âm hiện tại và hợp âm kế tiếp; đọc một chuỗi số phím tab có 1/7, 3/8, 6/0; tìm lại ô nhịp đang phát sau khi rời mắt; nhận ra dấu "?" và viền đứt |
| Đo lường | Tỷ lệ đọc sai, thời gian tìm lại vị trí, số lần phải nghiêng người lại gần, độ mỏi mắt và mức ưa thích tự báo sau 20 phút |
| Luật quyết định | Nếu A ngang hoặc hơn Daylight ở mọi điều kiện: A là mặc định ở mọi nơi. Nếu Daylight chỉ thắng dưới ánh sáng ban ngày: A vẫn mặc định, Daylight nằm ở một chạm trong top bar và Stand view, kèm một gợi ý một lần trên tablet. Nếu Daylight hoặc B thắng rõ ở đa số điều kiện: Daylight là mặc định cho Practice và Stand view, A giữ vai trò thương hiệu cho marketing, Library và phòng tối |

## Một shell thanh trên, và bài hát mở thẳng vào Practice

Shell hiện tại có thanh trên gồm wordmark, Library, nút chính **Import**, Settings, pill tiến độ upload và menu tài khoản. Trên điện thoại có thêm một thanh tab dưới (Library / Import / Settings). Allowance meter chỉ hiện trong Library ở màn hẹp, dù spec cũ đặt nó trong shell. Shell mới giữ thanh trên nhưng đổi vai các mục:

- **Library** chứa luôn một Progress strip;
- **Settings** giữ nguyên;
- **⌘K / Ctrl K** mở command palette;
- nút **"Add song"** toàn cục, cộng khả năng thả file ở bất cứ đâu trong app;
- allowance meter hiện ngay trên thanh ở màn rộng.

Trên điện thoại, ba mục Library / Add song / Settings xuống thanh dưới để nằm trong tầm ngón cái. Command palette là một suy luận: các ghi chú không tìm được nguồn gốc nào về quy ước palette. Nó vẫn đáng làm vì rẻ (chỉ ở phía client) và hợp với nguyên tắc "mọi thao tác dùng được bằng bàn phím". Các lệnh gồm mở bài, "Loop bars 17–20", đổi view, đổi theme và mở phần ánh xạ bàn đạp. Trên màn cảm ứng, palette mở được bằng một nút. Progress strip trả lời đúng câu hỏi mà màn hình chính phải trả lời, tức "tập tiếp chỗ nào". Nó gồm thẻ Continue, bảy chấm cho bảy ngày, và lượt sạch đầu tiên của các buổi gần nhất. Không có streak, không có huy hiệu.

"Add song" thay trang `/import` bằng một modal trên desktop và một sheet toàn màn hình trên điện thoại, với ba tab File / Link / Record. Bên cạnh là hai lựa chọn "Your part" và Analysis (Full / Lite). Mọi chức năng đang chạy được giữ nguyên: nhận diện trùng lặp ("You already have this song." với "Open it"), cảnh báo không chặn (file quá nhỏ tiếng, méo, gần như im lặng), luồng thu âm với Input level và count-in, các khóa allowance, và hàng đợi khi offline. Phần thêm vào là một khối "Works best with / Has trouble with" ngắn, áp dụng G1 và G2 (cho biết hệ thống làm được gì và làm tốt tới đâu) ([Amershi và cộng sự](https://www.microsoft.com/en-us/research/uploads/prod/2019/01/Guidelines-for-Human-AI-Interaction-camera-ready.pdf)) cùng lời khuyên của Songscription rằng môi trường thu âm ảnh hưởng tới độ chính xác hơn mọi biến số khác ([Songscription](https://www.songscription.ai/blog/accurate-ai-music-transcriptions)). Một trường Title tùy chọn, điền sẵn từ tên file, lấp khoảng trống hiện nay: không có chỗ đặt tên lúc nhập, và trường artist có trong dữ liệu nhưng chưa có UI. Sau khi bấm nút chính, bài hát mở thẳng vào Practice với audio cục bộ, như luồng hiện tại, còn upload chạy nền.

Practice sau đó đầy dần theo từng stage. Nguyên tắc chung: mỗi stage xong phải để lại một thành phẩm thật trên màn hình, không phải một hoạt ảnh giả.

| Stage (nhãn người dùng thấy) | Thành phẩm hiện ngay | Mở khóa trong Practice |
|---|---|---|
| Upload cục bộ, hoặc "Downloading" (link) | Waveform của file gốc ngay trên máy | Play, tốc độ, loop tính theo giây |
| "Reading the audio" | Waveform phía server, thời lượng | — |
| "Finding the beat" | BPM, lưới phách chạy theo nhạc, thước ô nhịp | Loop theo ô nhịp, count-in, metronome, beat pulse, section chip nếu có |
| "Listening for instruments" | "Heard: guitar, bass, keys" (dữ liệu đã có nhưng chưa bao giờ hiện) cùng câu hỏi "Is this your guitar?" | Đổi part trước khi tách stem |
| "Isolating your part", "Preparing the stems" | Waveform của từng stem | Tab Mix và các preset |
| "Working out the chords" | Dải hợp âm, cột Now | View Chords, Level & capo |
| "Transcribing your part", "Building the tab" | Tab hoặc Notes | View Tab/Notes, tab Fix |

Bảng trên áp dụng cả cho piano và trống, vốn hiện mở mọi thứ một lúc. Với hai nhạc cụ này, beat, stem và hợp âm vẫn đầy dần, chỉ phần nốt đến sau cùng. Timeline stage nằm trong song map và trong vùng ký hiệu còn trống. Nó có một thanh tiến trình chung theo phần trăm, có trọng số theo thời lượng điển hình của từng stage (tách stem chiếm phần lớn), cùng một ETA dạng khoảng có đệm như "about 3–5 min", chỉ cập nhật khi xong một stage và không bao giờ đứng ở 99 % ([NN/g](https://www.nngroup.com/articles/progress-indicators/)). Mỗi thành phẩm đến được báo nhỏ, chẳng hạn "Tab is ready — Show", và không bao giờ làm dàn lại ký hiệu ngay dưới playhead (HAX G14). Nút "Notify me when ready" chỉ xin quyền Web Push đúng lúc người dùng bấm nó. Trên iOS, nút này chỉ hiện khi app đã được cài ra Home Screen ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). Ở mọi nơi khác vẫn có toast trong app, cập nhật tiêu đề tab và badge. Email không có trong personal mode. "Processing machine offline — your song is queued and will start automatically." chỉ hiện một lần, kèm bước tiếp theo, không thành một thanh tiến trình đứng im ([Bray](https://www.kellogg.northwestern.edu/faculty/bray/doc/transparency/transparency.pdf)). Lỗi ở các stage phụ thuộc mềm được coi là kết quả dở dang dùng được: bài vẫn mở với những gì đã có, kèm lý do bằng lời thường và hai lựa chọn Retry / "Practise with chords". Stage nào cũng hủy được. Về trợ năng: `role="progressbar"` đi với `aria-valuetext` mang tên stage, và `role="alert"` chỉ dùng cho lỗi chặn mục tiêu của người dùng.

| Hiện tại | Sau thiết kế lại |
|---|---|
| `/library` với header và toolbar lọc | `/library` thêm thẻ Continue và Progress strip; giữ toolbar và URL state |
| `/import` là một trang riêng | "Add song" thành modal/sheet mở từ mọi nơi; `/import` và `?tab=record` mở thẳng modal |
| `/songs/$id/practice` với editor sheet | Giữ route; bố cục năm vùng; tab Fix thay editor sheet |
| `/songs/$id/edit` (desktop) | Giữ lại thành "Open full editor" trong Fix, dùng chung component |
| Settings 5 mục | 6 mục, thêm About; Keyboard & pedal có pedal wizard |
| Thanh tab dưới điện thoại: Library / Import / Settings | Library / Add song / Settings |

## Màn hình Practice: năm vùng phục vụ một vòng lặp

Màn hình Practice trên desktop chia thành năm vùng, mỗi vùng trả lời một câu hỏi của người chơi. Song map: tôi đang ở đâu trong bài? Cột Now: tôi chơi gì ngay bây giờ? Canvas: nốt nào? Inspector: tập thế nào? Transport dock: điều khiển lượt này.

```text
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ ←  Riff in A minor   Guitar · A minor · 96 BPM   [Tab|Notes|Chords]  ⋯? Unsure  Display  Keyboard & pedal  ⋯ │
├───────────────────────────────────────────────────────────────────────────────────────┤
│ [Intro][Verse 1][Chorus][Verse 2][Chorus][Outro]                                      │
│ ▁▂▅▇▅▂▁▂▅▇▇▅▂▁  waveform   ░░░ loop band 17–20 ░░░   ╱╱ unsure ╱╱   │ now-line        │
│ 1     5     9     13    17    21    25    29   …  bar ruler                           │
├──────────────┬──────────────────────────────────────────────────┬─────────────────────┤
│ NOW · bar 18 │  Am              F               C          G?    │ Loop  Mix  Progress  Fix │
│              │ ┌──────────────┐                                 │                     │
│   Am         │ │ bar 18 wash  │  tab + rhythm stems             │  (tab đang mở)      │
│  [shape]     │ │   │playhead  │  nốt unsure: viền đứt + "?"     │                     │
│  ● ○ ○ ○     │ └──────────────┘                                 │                     │
│ Next  F      │  ⌐ loop bracket 17–20 ────────────────────¬      │                     │
│ in 3 beats   │                                                  │                     │
│ then C · G   │                                                  │                     │
│ Level · Capo │                                                  │                     │
├──────────────┴──────────────────────────────────────────────────┴─────────────────────┤
│ ⟲  ▶  ⏭   18.2 / 64   Loop 17–20 · pass 2   −  75 % · 72 BPM  +   Count-in  Click  Your part loud  Vol │
│ Pass 2 at 75 % — how was it?      [ Felt clean  C ]   [ Not yet  N ]                    │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

### Thanh trên và song map: biết mình đang ở đâu trong bài

Thanh trên giữ đúng những gì người chơi cần khi đứng trước giá nhạc:

- nút quay lại;
- tên bài, kèm dòng part ("Guitar · A minor · 96 BPM", tông viết theo đúng giọng của bài);
- công tắc view theo nhạc cụ (Tab / Notes / Chords cho guitar và bass; Chart / Notes / Staff cho piano; Grid / Staff / Chords cho trống; Melody / Chords cho vocals);
- chip chú giải độ tin cậy;
- Display;
- Keyboard & pedal;
- menu ⋯.

Chip chú giải mở một popover: "Auto-transcribed — may contain errors (v0.4.0)", bảng ký hiệu ba mức, câu tần suất ("About 1 in 8 notes in this song are marked unsure"), và công tắc "Show uncertainty". Display gom các lựa chọn:

- theme (System / Night Rehearsal / Daylight) và độ tương phản;
- "Where is your screen?" và Reading size;
- Hyperlegible font;
- Follow (Page / Scroll / Off);
- kiểu playhead (đường kẻ, khối, kín đáo, theo mẫu Soundslice);
- Reduce motion.

Song map là dải overview cao 48 px hiện có, được nâng cấp. Bên trên là section chip (V3): chạm một chip là loop đúng section đó, nhãn sửa được, và khi không có dữ liệu thì dùng tên dự phòng "Part A/B/C", theo mẫu Sections bám nhịp đầu của Moises ([Moises](https://moises.ai/newsroom/product-announcements/new-song-sections-feature)). Dưới chip là waveform, thước ô nhịp, dải loop có tay nắm, vạch chéo ở ô nhịp không chắc, và now-line. Hiện tại dữ liệu section đã có trong data model nhưng chưa bao giờ hiện trên UI, nên giai đoạn 3 phải kiểm xem pipeline có thật sự sinh ra section không, trước khi hứa chip. Timeline hiện đã hỗ trợ zoom nhưng đang tắt. Bật zoom trên song map cần peaks tính sẵn ở nhiều độ phân giải, đây là một hạng mục phụ.

### Cột Now và canvas: đọc được từ 75 cm

Cột Now bên trái là vùng đọc lướt, gồm từ trên xuống:

- hợp âm hiện tại cỡ rất lớn kèm hình bấm (lật gương cho người thuận tay trái);
- beat pulse, tức visual metronome V9: bốn chấm, chấm phách mạnh khác hình, đập bằng đổi kích thước trong một vùng nhỏ thay vì chớp sáng, và tự chuyển sang chỉ đánh dấu phách mạnh khi tempo đủ cao để chạm ngưỡng 2.3.1;
- hợp âm kế tiếp kèm "in 3 beats";
- hai hợp âm sau đó;
- nút Level & capo.

Phải nói rõ: các ghi chú không tìm thấy sản phẩm nào có thẻ "hợp âm hiện tại / hợp âm kế tiếp" lớn kèm đếm ngược. Gần nhất là chế độ lưới của Moises, nơi hợp âm "chiếm màn hình bằng chữ lớn" ([Moises](https://moises.ai/blog/moises-news/apple-design-awards-nomination)). Splitune đã có "Next · in N beats" trên dải piano, nên cột Now là một phần mở rộng có cơ sở nội bộ, chứ chưa phải một mẫu đã được thị trường kiểm chứng.

Canvas ở giữa vẽ tab có đuôi nhịp, tên hợp âm trên các ô nhịp, nền tô ô nhịp đang phát, playhead amber, ngoặc loop, và nốt unsure với viền đứt cộng dấu "?". Không có trạng thái nào chỉ được thể hiện bằng màu. Follow mode có ba giá trị Page / Scroll / Off. Page là mặc định, và là chế độ duy nhất khi Reduce motion bật. Off dành cho lúc sửa.

### Inspector: bốn tab, bốn câu hỏi

Inspector bên phải lấy ý từ Track Inspector của LUNA 2 ([bonedo, qua tóm tắt tìm kiếm](https://www.bonedo.de/?p=2638133)) và các panel xếp chồng của Live 12 ([CDM](https://cdm.link/ableton-live-12-everything-new/)). Ở màn rộng nó được gắn cố định; ở màn hẹp hơn nó thu thành drawer.

**Loop** trả lời câu hỏi "lặp đoạn nào, thế nào". Tab này có:

- hai ô From bar / To bar với nút tăng giảm, giữ nút ‹ › dời mép từng nốt móc kép như hiện nay, thêm ±1 ô nhịp, "Shift loop" (dời đúng bằng độ dài loop, tức sang câu kế tiếp) và ×2 / ÷2;
- speed ladder V1 với các tham số Start, Target, Step, số lượt sạch mỗi bước, hạ một bước sau N lượt hỏng, hành động khi kết thúc, và count-in trước mỗi lượt. Đây là bộ tham số của Soundslice, cộng thêm hai thứ Soundslice còn thiếu: giảm tốc độ và lưu preset;
- Rest between repeats, Count-in, và công tắc "Ask how each pass went before the next";
- danh sách Saved clips, cuối cùng cũng có Rename và Delete. API xóa clip đã có, còn đổi tên cần kiểm.

**Mix** trả lời câu hỏi "nghe gì". Tab này có:

- mọi stem, với part của bạn ở trên cùng và có nhãn "Your part";
- mỗi stem có chữ M/S, fader, ô dB, nút Quieter/Louder để thay cho thao tác kéo, và nhãn "Rough" khi tách kém;
- một kênh Click, một kênh Chord synth và Master;
- ba preset "Your part loud", "Minus-one" và "Original";
- một chấm báo "đã chỉnh" trên lối vào Mix, theo mẫu Capo;
- limiter ở mức unity.

Hiện MVP chỉ có hai kênh (part và Backing), trong khi trang chủ đang hứa "fader riêng cho guitar, bass, drums, vocals và keys". Mixer nhiều stem vì thế là phạm vi mới cần pipeline xuất và lưu nhiều stem, chứ không phải re-skin.

**Progress** trả lời câu hỏi "tôi có tiến bộ không". Tab này có log tự động, best clean tempo của clip trong 30 ngày (endpoint lịch sử lượt cho từng clip đã có nhưng chưa dùng), "First clean pass" của buổi này so với buổi trước, bảy chấm cho bảy ngày, và nút "Warm up with yesterday's hard bars". Không có streak.

**Fix** trả lời câu hỏi "chỗ nào có thể sai". Tab này có:

- một hàng đợi các chỗ unsure, xếp theo hậu quả (sai cao độ hay dây/phím, lệch quãng tám, sai gốc hoặc tính chất hợp âm) thay vì theo xác suất thô;
- các phương án thay thế xếp hạng, với câu chữ "Second guess · about 1 in 3";
- nút "Hear it over the loop" để nghe thử phương án trên loop, gần với synth overlay của Soundslice ([Soundslice](https://www.soundslice.com/help/en/player/advanced/313/synth-overlay/));
- "Replace all in this song";
- dấu "edited" không dựa vào màu, Revert cho từng mục và công tắc "Show original";
- các sửa về phách: "This is beat 1", Half tempo, Double tempo, Move downbeat. Sửa xong thì re-quantize ngay trong trình duyệt bằng `music-core`, kèm dòng hệ quả như "Re-barred 84 bars — Undo".

Câu chữ phải nói "Your fixes are saved for this song", không ngụ ý mô hình học từ chúng.

### Transport dock và câu hỏi sau mỗi lượt

Transport dock gồm, từ trái sang phải:

- Restart (thành "Restart loop" khi đang lặp);
- Play cỡ 64 px;
- Next bar;
- vị trí, chạm để đổi giữa bar.beat và thời gian, theo mẫu Capo;
- pill loop "Loop 17–20 · pass 2";
- cụm tốc độ − / + với "75 % · 72 BPM"; Shift để bước 1 %; chạm vào số đọc để mở thanh trượt và các preset 50/60/70/75/80/90/100;
- Count-in;
- Click;
- preset Mix;
- âm lượng.

Dải tốc độ trong Practice hiện bị khóa ở 50–100 %, trong khi Settings cho 25 % và URL cho tới 200 %. Thiết kế lại nên thống nhất một dải rộng hơn, có lượt thử nhanh hơn bản gốc 105–110 % như ghi chú practice science đề xuất. Mức thấp nhất phải được kiểm chất lượng time-stretch, vì người dùng đã báo méo tiếng ở tốc độ rất chậm ([ASD App Store](https://apps.apple.com/us/app/amazing-slow-downer/id308998718)). Sau mỗi lượt, dòng câu hỏi "Pass 2 at 75 % — how was it?" hiện ngay trên dock với hai nút "Felt clean (C)" và "Not yet (N)". Câu hỏi có tốc độ trong đó để mỗi lần trả lời là một điểm dữ liệu đầy đủ cho Progress. Dock và mọi sheet đều phải qua phép kiểm 2.4.11: phần tử đang có focus không bao giờ bị che kín.

### Bảng phím và bàn đạp mới

| Hành động | Hiện tại | Đề xuất | Lý do |
|---|---|---|---|
| Play / pause | Space, Enter | Giữ; bàn đạp phải sau khi chạy wizard | Hai bàn đạp phải dành cho cặp hành động quan trọng nhất |
| Restart loop / lùi một ô nhịp | ←, PageUp | Giữ; bàn đạp trái sau khi chạy wizard | "Lặp tới khi ổn định" |
| Next bar | →, PageDown | Giữ | AirTurn Mode 3 gửi PageUp/PageDown |
| Chậm / nhanh 5 % | ↓ / ↑ | `,` / `.` (giữ Shift để bước 1 %). Khi chưa cấu hình, ↑/↓ hiện PedalHud "Pedal detected? Set it up" | AirTurn Mode 2 mặc định gửi Up/Down |
| Felt clean / Not yet | C / N | Giữ; gán được cho bàn đạp thứ ba và thứ tư | Chấm lượt không cần dùng tay |
| Loop on/off, Mute your part | L, M | Giữ | — |
| Next unsure | — | Phím mới, gán được cho bàn đạp | Rà cờ mà không cần nhìn quét |
| Command palette | — | ⌘/Ctrl K | Điều hướng và các lệnh ít dùng |
| Phím tắt một ký tự | Luôn bật | Công tắc On / Off / chỉ khi vùng tập có focus | WCAG 2.1.4 |

Mọi thao tác vẫn hiện xác nhận trên màn hình như hiện nay ("Speed 75 %", "Loop · bars 5–6"), nhưng ngưỡng mới là 100 ms. Phím của bàn đạp không bao giờ làm cuộn trang hay kích hoạt control đang focus. Ở màn rộng nhất, cả năm vùng cùng hiện. Ở màn hẹp hơn, inspector thu thành drawer bật tắt bằng nút và cột Now gọn thành một dải ngang trên canvas. Chính ở các điểm chuyển bố cục này mà Stand view và layout điện thoại tách ra thành bề mặt riêng.

## Các bề mặt còn lại: mỗi thiết bị một vai

### Piano và trống

Với piano, view "Notes" (nốt rơi xuống bàn phím, phím sáng kèm L/R cho từng tay) là một công cụ hỗ trợ, không phải view chính. Có bằng chứng thực nghiệm rằng tách màn hình nốt khỏi phím đàn tạo hiệu ứng chia sự chú ý: chiếu piano roll lên thẳng phím đàn tốt hơn nốt rơi kiểu Synthesia trên một màn hình riêng ([Rogers và cộng sự 2014](https://www.uni-ulm.de/fileadmin/website_uni_ulm/iui.inst.100/1-hci/hci-paper/2014/2014-gugenheimer-piano.pdf)). Người học cũng than rằng nốt cuộn ngang làm việc chuyển sang đọc bản nhạc thật khó hơn ([r/pianolearning](https://libreddit.winscloud.net/r/pianolearning/comments/1b8slc5/how_do_you_think_about_learning_piano_online/)). Vì vậy Chart và Staff vẫn ở hàng đầu, còn phím đàn nằm dưới đáy vùng ký hiệu. Muốn mute riêng một tay, tức tay kia vẫn phát trong khi bạn chơi tay này, thì cần âm thanh tách theo tay. Splitune hiện chỉ có stem theo nhạc cụ, nên đây là phạm vi về sau; trước mắt có thể dùng synth để phát tay kia.

Trống có lưới năm lane (Cymbals, Hi-hat, Toms, Snare, Kick), một chú giải kiểu "percussion legend" của Soundslice vì ký hiệu bộ gõ không thống nhất ([Soundslice](https://www.soundslice.com/help/en/player/advanced/329/percussion-legends/)), và một mixer theo từng mảnh trống ("Kick only", "Drums minus snare") đã lên kế hoạch ở step s30. Người chơi trống bận cả hai chân, nên trải nghiệm không được phụ thuộc bàn đạp. Thay vào đó là loop tự lặp có count-in, tùy chọn "continue after N passes", mặc định preset khoảng cách Far, và gán một pad của trống điện qua Web MIDI ở những trình duyệt có hỗ trợ.

### Stand view trên tablet

Stand view là nơi ý tưởng của hướng C được dùng, nhưng không thành ngôn ngữ hình ảnh chung. Nó gồm:

- hợp âm hiện tại và kế tiếp cỡ lớn;
- bộ đếm "Bar 18 of 64 · Loop 17–20 · pass 2" bằng chữ số tabular;
- một hệ tab lớn, bảo đảm nằm trọn màn hình như cam kết của chế độ Paged ở Soundslice;
- gợi ý bàn đạp ở mép dưới ("Left pedal: Restart loop · Right pedal: Play");
- lật trang theo đồng hồ audio.

Newzik phải nghe micro mới lật trang được ([Newzik](https://en.blog.newzik.com/blog/audiomatching-tourne-page-cest-quoi)); Splitune biết chính xác vị trí phát nên làm được mà không cần micro. Khi tablet đặt dọc, hai hệ tab xếp chồng. Lúc playhead sang hệ dưới thì hệ trên được thay bằng hệ kế tiếp (lật nửa trang), nên mắt lúc nào cũng thấy ô nhịp tiếp theo. Khi tablet đặt ngang, một mẩu của ô nhịp kế tiếp hiện ở mép phải. Bấm bàn đạp lật trang bằng tay luôn thắng lật tự động. Wake lock được giữ suốt buổi.

### Điện thoại: nhìn lướt trước, Tools khi cần

Practice trên điện thoại dọc mặc định là view nhìn lướt: hợp âm hiện tại cỡ lớn kèm hình bấm, hợp âm kế tiếp với "in N beats", vị trí bar.beat, pill loop và nút "Loop this bar". Transport nằm trong tầm ngón cái. Đây cũng là chỗ sửa khoảng trống lớn nhất hiện nay: **điện thoại không có nút nào để mở mixer, count-in, metronome, âm lượng, level, capo hay tùy chọn piano.** Sheet "Tools" lấy mẫu Control Strip của Capo: một hàng các bộ control (Speed / Mix / Count-in & click / Level & capo / Volume), mỗi bộ có chấm báo "đã chỉnh" ([Capo](https://supermegaultragroovy.com/products/capo/help/ios/4.5/control-strip/)). Mọi control đều có nút bước để thay cho thao tác kéo (2.5.7). Khi điện thoại xoay ngang, view chuyển sang một dải tab cuộn ngang theo kiểu "only scroll when necessary", với thước ô nhịp gọn.

### Library

Library trên desktop mở đầu bằng thẻ Continue và Progress strip. Bên dưới là lưới hoặc danh sách bài, giữ nguyên tìm kiếm, bộ lọc nhạc cụ và trạng thái, cách sắp xếp và URL state. Mỗi thẻ bài có ô nhạc cụ, tên bài, badge trạng thái, "Practised 3 days ago" và "Best 85 % on bars 17–20". Bài đang xử lý hiện tên stage và ETA dạng khoảng. Bài lỗi hiện lý do, "This didn't use an analysis." và Try again. Bài có stem đã hết hạn hiện "Re-create stems". Trên điện thoại chỉ có dạng danh sách, Add song nằm ở thanh dưới, và các thao tác phụ nằm trong menu overflow, không dùng cử chỉ vuốt. Trạng thái offline "Needs connection", làm mờ những bài chưa lưu offline, thuộc V10 và nên đi cùng giai đoạn này.

### Marketing, sign-in, onboarding và pricing

Trang chủ phải thôi hứa những gì app chưa làm. Câu "fader riêng cho từng nhạc cụ" chỉ được giữ khi mixer nhiều stem đã có. Khối "How accurate is it?" dùng cách nói theo tần suất và danh sách "Works best with / Has trouble with". Ảnh minh họa là màn hình Practice thật ở theme mặc định. Sign-in giữ username và mật khẩu, nút "Continue with Google" chỉ hiện khi đã cấu hình, và không có email. Onboarding biến bước "Where's your screen?" thành một bài kiểm tra khoảng cách đọc thật: người dùng đặt thiết bị ở đúng chỗ họ sẽ chơi, xem mẫu hợp âm Am và F cùng tab "0 2 2 1 0" ở preset đã chọn, rồi chọn "I can read it" hoặc "Bigger". Kết quả trở thành Reading size. Piano và trống chỉ hết "Coming soon" khi đã có bài mẫu cho chúng. Pricing giữ banner "Demo mode", không bao giờ có ô nhập thẻ, và giữ ma trận tính năng trung thực, theo spec 25 về personal mode.

### Settings và pedal wizard

Settings có sáu mục: Profile, Display & reading, Keyboard & pedal, Plan & billing, Privacy và About. About là mục mới, chứa phiên bản app, phiên bản model chép nhạc và giấy phép font. Display & reading gom theme, độ tương phản, khoảng cách đọc, Reading size, Hyperlegible font, Reduce motion, Show uncertainty và Follow mode. Mục này còn có tiểu mục Practice defaults: tốc độ khởi đầu, count-in, nghỉ giữa các lượt, và "Sound delay" được thay bằng bước hiệu chỉnh "tap along" với dải bù đủ rộng cho tai nghe Bluetooth.

Keyboard & pedal mở bằng câu hỏi "Have a pedal? Set it up", dẫn vào pedal wizard:

1. "Press your left pedal" và bắt phím thiết bị gửi, dù là Up/Down của Mode 2, PageUp/PageDown của Mode 3 hay Space/Enter.
2. "Press your right pedal".
3. Hiện kết quả ánh xạ (bàn đạp trái = Restart loop, phải = Play), cho phép đảo hai bàn đạp và gán thêm bàn đạp.
4. Tự gỡ các phím mặc định bị trùng.
5. Kết thúc bằng một vùng thử.

PedalHud cũng mở wizard này khi người dùng bấm ↑/↓ lần đầu mà chưa cấu hình. Bảng "Learn this pedal" theo từng hành động hiện có vẫn được giữ cho người dùng nâng cao, cộng thêm công tắc phím tắt một ký tự.

### Trạng thái hệ thống

Mọi trạng thái hiện có đều được thiết kế lại trọn gói, không để lại màn hình nào theo kiểu cũ:

- trang trình duyệt không hỗ trợ, nêu đúng phần còn thiếu ("AudioWorklet, which plays your stems in sync");
- banner offline;
- "A new version is ready", không bao giờ hiện trong lúc đang phát;
- banner trình duyệt trong app khác;
- mẹo khi màn hình không giữ sáng được;
- "Playback paused by another app or a call." với nút "Tap to resume";
- trang 404 và trang lỗi kèm mã lỗi;
- các dialog đổi tên, xóa bài và xóa tài khoản (có bước xác nhận lại danh tính);
- các toast "Edit saved" kèm Undo, "Renamed.", "Song deleted.";
- "Processing machine offline".

Văn phong giữ nguyên chuẩn hiện tại: một huấn luyện viên điềm tĩnh, câu ngắn, số liệu thật, không emoji, lỗi luôn theo cấu trúc "chuyện gì xảy ra, nghĩa là gì, bạn làm được gì".

## Tám giai đoạn, mỗi giai đoạn thay trọn một màn hình

Bài học của Kontakt 8 quyết định cách triển khai: mỗi lần giao là thay trọn một màn hình, không bao giờ để phần mới và phần cũ chung một màn. Token đi trước để mọi component mới đứng trên cùng một nền. Mỗi component và mỗi màn hình có story cho từng trạng thái, chạy kèm axe trên Chromium và WebKit (`pnpm --filter web test:stories`). Màn hình mới nằm sau một feature flag cho tới khi đạt đủ chức năng của bản cũ, rồi bản cũ bị gỡ hẳn. Giai đoạn 0 có thêm một việc mang tính thủ tục nhưng bắt buộc. `CLAUDE.md` và `AGENTS.md` hiện ghi rằng UI phải theo hệ "Music Stand" (docs 26–28), nên phải viết spec mới thay cho 26–28 và sửa quy tắc đó trước khi code. Spec 25 về personal mode vẫn ràng buộc: mock billing, không bật tài nguyên Railway hay Cloudflare tính phí khi chưa hỏi.

| Giai đoạn | Bàn giao | Vùng repo | Cỡ | Cổng ra |
|---|---|---|---|---|
| 0. Chọn hướng và thử giá nhạc | Prototype Practice tĩnh ở ba token set; bài thử giá nhạc; ADR chọn mặc định; spec mới thay docs 26–28; sửa quy tắc UI trong `CLAUDE.md`/`AGENTS.md` | `docs/specs`, một route thử nghiệm sau flag trong `apps/web` | S–M | Luật quyết định của bài thử cho ra một kết quả có số liệu |
| 1. Nền móng | Primitives OKLCH (graphite ấm, amber, 6–8 hue stem theo từng chế độ); bộ sinh Night / Daylight / More contrast; font (Instrument Sans, JetBrains Mono, Bravura, giữ Atkinson); bộ icon; re-skin component gốc (button, toggle, tabs, slider, number-field, dialog, drawer, popover, toast, badge, kbd) | `packages/ui-tokens/src/*` (primitives, themes, theme.tailwind, fonts, các test), `scripts/fonts`, `apps/web/app/ui/*` và `icons`, các file stories | L | Test tương phản và bảng màu xanh ở mọi theme; mô phỏng mù màu cho stem; axe đạt; `check-ui-tokens` đạt |
| 2. Lõi Practice, bàn phím và bàn đạp | Bố cục năm vùng; top bar; song map (chưa có section); canvas (đuôi nhịp, nền ô nhịp, lớp playhead theo đồng hồ audio, Follow Page/Scroll/Off); transport dock và câu hỏi sau lượt; inspector với Loop và Mix hai kênh; keymap mới; công tắc phím một ký tự; pedal wizard; PedalHud | `apps/web/app/features/practice/*` (`layout.ts`, `model/keymap.ts`, status bar, transport, timeline), `packages/notation`, `packages/audio-engine` | L | E2E chỉ dùng bàn phím; xác nhận ≤ 100 ms; 2.4.11; tạo loop trong ≤ 2 thao tác, dưới 3 s |
| 3. Chiều sâu Practice | Speed ladder V1; section V3; mixer nhiều stem với click và chord synth; tab Fix (hàng đợi, nghe thử, re-quantize có xem trước); tab Progress (30 ngày, lượt sạch đầu buổi); visual metronome V9; cột Now; đổi tên và xóa clip; hiệu chỉnh độ trễ; view piano và trống | `features/practice`, `packages/contracts` (trainer, sections, chỉ số Progress), `packages/music-core`, `packages/audio-engine`, `services/ml` và `apps/node-worker` (xuất stem), `apps/api`, `packages/analytics` | L | Kiểm 2.3.1 ở tempo cao; chỉ số giữ chân ghi được; PAIR trust probes cho Fix; độ tin cậy hiệu chỉnh cho từng stage trước khi hiện |
| 4. Library, Add song, xử lý tăng dần | Shell thanh trên, ⌘K, thả file ở bất cứ đâu, allowance meter; modal/sheet Add song; timeline stage có thành phẩm; "Is this your instrument?"; Notify me when ready (service worker, endpoint đăng ký push); thẻ Continue và Progress strip | `features/shell`, `features/library`, `features/import`, `ui/stage-list.tsx`, `apps/api/src/events.ts`, `apps/api` (đăng ký push), `packages/contracts`, `packages/db` | M–L | Mở app tới lượt có tiếng < 10 s; ETA không bao giờ đứng; live region chỉ báo mốc; chỉ xin quyền push khi người dùng bấm |
| 5. Điện thoại và Stand view | Practice nhìn lướt trên điện thoại cùng sheet Tools; layout ngang; Stand view lật nửa trang theo audio; gợi ý bàn đạp | `features/practice/layout.ts` và các view theo thiết bị, `packages/notation` | M–L | Thử trên thiết bị thật (iPad Safari, Android Chrome); wake lock 15 phút; không bao giờ lật trang giữa một hệ |
| 6. Marketing, auth, onboarding, settings, billing, trạng thái hệ thống | Home, How it works, Pricing (mock), Sign in và Create account, onboarding có bài kiểm tra khoảng cách đọc, sáu mục Settings và About, các trang system, toast, dialog | `features/marketing`, `auth`, `onboarding`, `settings`, `billing`, `system`, `apps/web/messages/en.json` | M | Copy test không có chuỗi cứng; axe đạt; mọi trạng thái đều có story |
| 7. QA và phát hành | E2E Playwright trên các trình duyệt Tier 1; regression hình ảnh; hiệu năng playhead; chạy lại bài thử giá nhạc trên bản thật; gỡ màn hình cũ và flag; cập nhật `docs/status.md`, `docs/progress-log.md` | Toàn `apps/web`, `docs` | M | Mọi tiêu chí nghiệm thu đạt; không còn màn hình kiểu cũ |

### Tiêu chí nghiệm thu

| Tiêu chí | Ngưỡng | Cách kiểm |
|---|---|---|
| Không dùng màu làm tín hiệu duy nhất (1.4.1) và tương phản không-chữ (1.4.11) | Độ tin cậy, loop, clean/not yet, stem "Rough", phách mạnh đều có hình hoặc chữ; ≥ 3:1 | Story kèm mô phỏng mù màu; `contrast.test.ts` |
| Tương phản chữ (1.4.3) | ≥ 4,5:1 ở Night, Daylight và More contrast, kể cả chữ số tab và nét mảnh của ký hiệu | Test token; axe |
| Phím tắt một ký tự (2.1.4) | Tắt được, gán lại được, hoặc chỉ hoạt động khi có focus | E2E |
| Pause, Stop, Hide (2.2.2) | Dừng phát thì dừng cuộn | E2E |
| Nhấp nháy (2.3.1) | Không quá 3 lần chớp mỗi giây ở mọi tempo; nhịp đập trong vùng nhỏ | Unit test lịch nhịp đập ở tempo cao; kiểm bằng mắt |
| Focus không bị che (2.4.11) | Dock, sheet Tools và drawer không bao giờ che kín phần tử đang focus | E2E bàn phím khi dock và sheet đang mở |
| Thao tác kéo (2.5.7) | Tay nắm loop, fader, tốc độ, vách chia đều có nút bước hoặc ô nhập số | E2E không kéo |
| Kích thước target | ≥ 24 px theo AA (2.5.8); luật nội bộ ≥ 44 px; control chính khi tập 64 px | Lint hoặc story đo kích thước |
| Reduced motion | Lật theo trang, playhead đi theo bước, không fade | Story với media query giả lập |
| Phản hồi | Mọi phím và bàn đạp được xác nhận ≤ 100 ms | Đo thời gian tự động trong E2E |
| Độ trễ khi chơi cùng | Có bước hiệu chỉnh tap-along; dải bù đủ cho Bluetooth; sau hiệu chỉnh lệch ≤ 25 ms | Thử trên thiết bị, có dây và không dây |
| Hiệu suất vòng lặp | Tạo loop ≤ 2 thao tác, < 3 s; mở app tới lượt có tiếng < 10 s | Test có điều phối |
| Bàn đạp | Ghép được một cặp trong < 30 s với AirTurn Mode 2, 3, 5 và ba chế độ iRig, trên iPadOS Safari, Android Chrome và desktop | Ma trận thiết bị |
| Wake lock | Màn hình không tối trong 15 phút ở tab trình duyệt và PWA đã cài | Thử trên thiết bị |

### Cổng nghiên cứu và kiểm thử

| Cổng | Câu hỏi | Phương pháp | Quyết định phụ thuộc |
|---|---|---|---|
| G0 (giai đoạn 0) | Theme nào đọc tốt nhất ở 0,5 / 0,75 / 1,5 m? | Bài thử giá nhạc ở trên | Theme mặc định cho Practice và Stand view |
| G1 (giai đoạn 1) | JetBrains Mono có làm chữ số tab dễ phân biệt hơn Instrument Sans hoặc Inter với tabular figures không? | Đọc chuỗi số ở ba khoảng cách | Font cho chữ số tab |
| G2 (giai đoạn 3) | Độ tin cậy của từng stage (beats, chords, notes) có được hiệu chỉnh không? | Biểu đồ độ tin cậy trên tập eval | Stage nào được hiện dấu unsure |
| G3 (giai đoạn 3) | Hàng đợi Fix có làm người dùng tin đúng mức không? | PAIR trust probes, thời gian hoàn thành tác vụ trên fixture | Ngưỡng và mật độ cờ |
| G4 (giai đoạn 2) | Wizard có ghép được mọi chế độ bàn đạp không? | Ma trận AirTurn và iRig trên ba trình duyệt | Keymap mặc định |
| G5 (sau giai đoạn 3) | Cỡ bước và số lượt sạch mỗi bước của ladder có ảnh hưởng tới lượt sạch buổi sau không? | A/B trong app, đo lượt sạch đầu buổi kế tiếp | Mặc định của ladder |
| G6 (giai đoạn 5) | Sheet Tools trên điện thoại có dùng được khi đang cầm đàn không? | Test có điều phối với đàn trên tay | Thứ tự các bộ control |
| G7 (giai đoạn 2) | `getOutputTimestamp` trên Safari có đáng tin không? | Đo độ lệch playhead so với audio | Có cần đường dự phòng `currentTime` không |

### Rủi ro

| Rủi ro | Dấu hiệu sớm | Giảm thiểu |
|---|---|---|
| Ký hiệu tối khó đọc ban ngày | G0 nghiêng về Daylight hoặc B | Luật quyết định đã định trước; Daylight ở một chạm |
| Instrument Sans hoặc JetBrains Mono không đạt | Thiếu ký tự, không có tabular figures, đọc sai ở G1 | Quay về Inter 4 với Display cuts và tabular figures |
| Amber đụng màu stem hoặc cảnh báo | Mô phỏng mù màu không phân biệt được | Loại dải hue cam–vàng khỏi stem; cảnh báo dùng hình |
| Mixer nhiều stem tốn tính toán và dung lượng | Thời gian tách trên máy Mac tăng mạnh; dung lượng R2 gói miễn phí | Ước tính trước; hỏi chủ app trước khi mở rộng tài nguyên tính phí |
| Web Push chỉ có trên iOS khi đã cài PWA | Người dùng iOS không thấy nút | Toast trong app, badge, cập nhật tiêu đề tab làm đường chính |
| Giao diện chuyển đổi nửa vời | Một màn hình vừa mới vừa cũ | Flag theo màn hình; gỡ bản cũ ở giai đoạn 7 |
| Phạm vi mới bị ngụy trang thành re-skin | Giai đoạn 3 kéo dài | Bảng phân loại phạm vi bên dưới; V1, V3, V9 lên kế hoạch như tính năng |
| Quá nhiều cờ unsure làm người dùng bỏ qua | Người dùng tắt "Show uncertainty" | Gộp thành "shaky bar"; xếp theo hậu quả; chạy G3 |
| Con trỏ giật như lỗi alphaTab #318 | Playhead vượt rồi giật lại | Bản đồ phách–thời gian, không ngoại suy |

### Phạm vi mới hay chỉ là re-skin

| Hạng mục | Loại | Phụ thuộc backend | Cỡ |
|---|---|---|---|
| Token, chữ, icon, component gốc, bố cục mọi trang | Re-skin và tái cấu trúc | Không | L tổng cộng |
| Shell thanh trên, Add song dạng modal, route map | Tái cấu trúc | Không | M |
| Allowance meter trong shell, Follow "Off", câu hỏi sau lượt có tốc độ, ⌘K, About, công tắc phím một ký tự | UI trên dữ liệu đã có | Không | S mỗi mục |
| Sheet Tools trên điện thoại | UI trên control đã có | Không | M |
| Đổi tên và xóa clip | UI trên API đã có (xóa có sẵn; đổi tên cần kiểm) | Có thể cần thêm | S |
| Tab Progress với lịch sử 30 ngày | UI trên endpoint chưa dùng | Thêm chỉ số lượt sạch đầu buổi | M |
| Thành phẩm trong timeline stage, "Heard: …" | UI trên dữ liệu chưa hiện | Không hoặc ít | S–M |
| Speed ladder V1 | Phạm vi mới | Contract trainer đã có | M |
| Section V3 | Phạm vi mới | Cần kiểm pipeline có sinh section không | M–L |
| Visual metronome V9 | Phạm vi mới | Không | S–M |
| Mixer nhiều stem, kênh chord synth | Phạm vi mới | Pipeline, lưu trữ, audio engine | L |
| Tab Fix: xếp hàng theo hậu quả, re-quantize có xem trước, Replace all | Phạm vi mới, một phần dựa trên editor đã có | Xếp hạng cần dữ liệu eval | L |
| "Is this your instrument?" và đổi part không tải lại | Phạm vi mới | Chạy lại các stage phía sau | M |
| Notify me when ready (Web Push) | Phạm vi mới | Service worker, endpoint, bảng đăng ký | M |
| Stand view lật trang theo audio | Phạm vi mới | Không | M |
| Pedal wizard, hiệu chỉnh độ trễ | Phạm vi mới | Không | S–M mỗi mục |
| Mixer theo mảnh trống (s30), mute theo tay cho piano | Phạm vi mới, về sau | Tách stem sâu hơn | L |

Bảng này cho thấy phần re-skin thuần, dù lớn về khối lượng, có rủi ro thấp. Phần quyết định trải nghiệm (ladder, section, mixer nhiều stem, Fix, Progress, thông báo) là tính năng mới, và nên được ước lượng, review và đặt cổng như tính năng, không như việc đổi giao diện.

## Kết luận

Những thay đổi có tác động lớn nhất trong kế hoạch này lại rẻ nhất, và không cái nào là hình ảnh. Gỡ ↑/↓ khỏi tốc độ để chiếc AirTurn để nguyên chế độ gốc không phá buổi tập, mở rộng dải bù độ trễ cho tai nghe Bluetooth, và đo lượt sạch đầu tiên của buổi sau thay cho số phút: ba việc đó sửa những chỗ mà một bản re-skin đẹp đến đâu cũng che không được. Ngược lại, câu hỏi gây tranh luận nhất, nền tối hay nền giấy, hóa ra lại đảo ngược được, vì khi Night và Daylight sinh từ cùng bốn tham số, bài thử giá nhạc chỉ chọn giá trị mặc định chứ không chọn bản sắc. Điều đó cho phép theo đuổi A một cách tự tin mà không phải đặt cược độ dễ đọc của sản phẩm vào nó.

Về cạnh tranh, khi Songsterr đã chuyển audio thành tab trong vài phút, lợi thế bền của Splitune không nằm ở bản chép nhạc mà ở hai khoảnh khắc đối thủ bỏ trống. Khoảnh khắc thứ nhất là lúc chờ, khi người dùng đã tập được trên audio của chính mình trong lúc stem còn đang tách. Khoảnh khắc thứ hai là lúc nghi ngờ, khi một dấu "?" dẫn thẳng tới một lượt nghe thử chậm trên loop thay vì một con số xác suất. Nếu bản thiết kế lại làm hai khoảnh khắc đó ngắn hơn và trung thực hơn, phần còn lại của giao diện chỉ cần không cản đường.
