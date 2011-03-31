#!/usr/bin/perl

use POSIX qw(ceil floor);

my @list;
while(<>) {
	push @list, $_;
}
my @list = sort(@list);

my $median;
if((scalar(@list) / 2) % 2 == 0) {
	$median = ($list[scalar(@list) / 2] + $list[scalar(@list) / 2 + 1]) / 2;
} else {
	$median = $list[ceil(scalar(@list) / 2)];
}
my $lq;
if((scalar(@list) / 4) % 2 == 0) {
	$lq = ($list[scalar(@list) / 4] + $list[scalar(@list) / 4 + 1]) / 2;
} else {
	$lq = $list[ceil(scalar(@list) / 4)];
}
my $uq;
if((scalar(@list) / 4) % 2 == 0) {
	$uq = (3 * $list[scalar(@list) / 4] + $list[3 * scalar(@list) / 4 + 1]) / 2;
} else {
	$uq = $list[3 * ceil(scalar(@list) / 4)];
}
my $iq = $uq - $lq;
my $upper_threshold = $uq + $iq * 3;
my $lower_threshold = $lq - $iq * 3;

my @trimmed_list;
my @outliers;
foreach(@list) {
	if($_ >= $lower_threshold && $_ <= $upper_threshold) {
		push @trimmed_list, $_;
	} else {
		push @outliers, $_;
	}
}

my $sum = 0;
foreach(@trimmed_list) {
	$sum += $_;
}
my $mean = $sum / scalar(@trimmed_list);

my $sigma = 0;
foreach(@trimmed_list) {
	$sigma += ($_ - $mean)**2;
}

my $sd = sqrt($sigma / (scalar(@list) - 1));

print join("\n",
sprintf("Median: %.0f", $median),
sprintf("Upper Quartile: %.0f", $uq),
sprintf("Lower Quartile: %.0f", $lq),
sprintf("IQ Range: %.0f", $iq),
"Outliers: " . scalar(@outliers),
"Inliers: " . scalar(@trimmed_list),
sprintf("Mean: %.0f", $mean),
sprintf("Standard Deviation: %.0f", $sd),
sprintf("Mean+1: %.0f", ($mean + $sd)),
sprintf("Mean-1: %.0f", ($mean - $sd))), "\n";